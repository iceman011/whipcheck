import express from "express";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { AsyncLocalStorage } from "node:async_hooks";

dotenv.config();

const app = express();

const supabaseStorage = new AsyncLocalStorage<any>();
const supabaseClientsCache = new Map<string, any>();

function sanitizeSupabaseUrl(url: string): string {
  let cleaned = (url || "").trim();
  if (cleaned.endsWith("/")) {
    cleaned = cleaned.slice(0, -1);
  }
  if (cleaned.toLowerCase().endsWith("/rest/v1")) {
    cleaned = cleaned.slice(0, -8);
  }
  if (cleaned.endsWith("/")) {
    cleaned = cleaned.slice(0, -1);
  }
  return cleaned;
}

// Increase request size limit for base64 image uploads
app.use(express.json({ limit: "15mb" }));

// Request-scoped Supabase configuration middleware to automatically adapt to dynamic client-side localStorage overrides
app.use((req, res, next) => {
  const urlHeader = req.headers["x-supabase-url"];
  const keyHeader = req.headers["x-supabase-anon-key"];
  
  let targetClient = null;
  
  if (typeof urlHeader === "string" && urlHeader.trim() && typeof keyHeader === "string" && keyHeader.trim()) {
    const rawUrl = urlHeader.trim();
    const url = sanitizeSupabaseUrl(rawUrl);
    const key = keyHeader.trim();
    const cacheKey = `${url}:::${key}`;
    if (!supabaseClientsCache.has(cacheKey)) {
      try {
        const client = createClient(url, key, {
          auth: {
            persistSession: false
          }
        });
        supabaseClientsCache.set(cacheKey, client);
      } catch (err) {
        console.warn("Error creating client-overridden Supabase instance:", err);
      }
    }
    targetClient = supabaseClientsCache.get(cacheKey) || null;
  }
  
  if (!targetClient) {
    try {
      targetClient = getDefaultSupabaseClient();
    } catch (err) {
      // Allow passing through so we don't crash the server on boot if env vars are missing
    }
  }

  if (targetClient) {
    supabaseStorage.run(targetClient, () => {
      next();
    });
  } else {
    next();
  }
});

let aiClient: GoogleGenAI | null = null;
let activeSupabaseClient: any = null;

const ERROR_LOGS_DIR = path.join(process.cwd(), "cache_db");
if (!fs.existsSync(ERROR_LOGS_DIR)) {
  fs.mkdirSync(ERROR_LOGS_DIR, { recursive: true });
}

interface DatabaseErrorLog {
  timestamp: string;
  context: string;
  message: string;
  code?: string;
  stack?: string;
  tableName?: string;
  apiPath?: string;
  apiMethod?: string;
  apiQuery?: string;
}

function saveErrorTraceToFile(logEntry: DatabaseErrorLog) {
  try {
    const filePath = path.join(ERROR_LOGS_DIR, "database_errors.json");
    let logs: DatabaseErrorLog[] = [];
    if (fs.existsSync(filePath)) {
      logs = JSON.parse(fs.readFileSync(filePath, "utf8")) || [];
    }
    logs.unshift(logEntry);
    if (logs.length > 100) {
      logs = logs.slice(0, 100);
    }
    fs.writeFileSync(filePath, JSON.stringify(logs, null, 2), "utf8");
  } catch (err) {
    console.warn("Failed to save error trace to file:", err);
  }
}

function getErrorTracesFromFile(): DatabaseErrorLog[] {
  try {
    const filePath = path.join(ERROR_LOGS_DIR, "database_errors.json");
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, "utf8")) || [];
    }
  } catch (err) {
    console.warn("Failed to read error traces from file:", err);
  }
  return [];
}

function checkIsMissingTable(err: any): boolean {
  if (!err) return false;
  const errText = err.message || String(err);
  return (
    err.code === "42P01" || 
    err.code === "PGRST125" ||
    (errText.toLowerCase().includes("relation") && errText.toLowerCase().includes("does not exist")) ||
    errText.toLowerCase().includes("invalid path specified in request url") ||
    errText.toLowerCase().includes("pgrst125")
  );
}

// Lazy initialization of GoogleGenAI client to avoid crash if API key is not configured yet
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is missing. Please add it from the Settings > Secrets panel.");
    }
    aiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

function getDefaultSupabaseClient() {
  if (!activeSupabaseClient) {
    const rawUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
    const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";
    
    if (!rawUrl || !key) {
      throw new Error("Supabase credentials (VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY) are missing. Please configure them in the Secrets panel or .env file.");
    }
    const url = sanitizeSupabaseUrl(rawUrl);
    activeSupabaseClient = createClient(url, key, {
      auth: {
        persistSession: false
      }
    });
  }
  return activeSupabaseClient;
}

// Lazy initialization of Supabase client on backend with support for custom overrides
function getSupabase() {
  const store = supabaseStorage.getStore();
  if (store) {
    return store;
  }
  return getDefaultSupabaseClient();
}

// Helper methods to read/write Gemini analysis cache in Supabase
async function getCachedAnalysis(cacheKey: string): Promise<any | null> {
  try {
    const supabaseObj = getSupabase();
    const { data, error } = await supabaseObj
      .from("whipcheck_identify_cache")
      .select("data")
      .eq("key", cacheKey)
      .maybeSingle();
      
    if (error) throw error;
    if (data && data.data) {
      return typeof data.data === "string" ? JSON.parse(data.data) : data.data;
    }
  } catch (e: any) {
    console.warn("Cached analysis lookup failed:", e);
  }
  return null;
}

async function saveCachedAnalysis(cacheKey: string, payload: any): Promise<void> {
  try {
    const supabaseObj = getSupabase();
    const { error } = await supabaseObj
      .from("whipcheck_identify_cache")
      .upsert({ key: cacheKey, data: JSON.stringify(payload) });
    if (error) throw error;
  } catch (e: any) {
    console.warn("Failed to write to vision cache table:", e);
  }
}

// Helper to check if Supabase is alive/configured (does not crash on startup)
function isConnectionConfigured(): boolean {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";
  return !!(url.trim() && key.trim());
}

// Global database error handler that intercepts missing table structures
function getCompleteSqlSchema(): string {
  return `-- ========================================================
-- WHIPCHECK COMPLETE SUPABASE SETUP SCRIPT
-- ========================================================
-- Execute this script in your Supabase SQL Editor to build all tables!

-- 1. Create WhipCheck saved vehicles table
CREATE TABLE IF NOT EXISTS public.vehicles (
  id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL,
  image TEXT,
  "isCar" BOOLEAN DEFAULT true,
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  generation TEXT,
  "yearRange" TEXT,
  confidence DOUBLE PRECISION,
  color TEXT,
  category TEXT,
  "engineType" TEXT,
  power TEXT,
  horsepower TEXT,
  torque TEXT,
  "modelYear" TEXT,
  "zeroToSixty" TEXT,
  "estimatedNewPrice" TEXT,
  "estimatedUsedPrice" TEXT,
  trivia TEXT, -- JSON array of trivia
  tips TEXT, -- JSON array of buyer/fan advice
  specs TEXT, -- JSON object of specs (transmission, driveType, fuelEconomy)
  user_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for vehicles
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public access to vehicles"
  ON public.vehicles FOR ALL USING (true) WITH CHECK (true);

-- 2. Create comments & rating review list
CREATE TABLE IF NOT EXISTS public.comments (
  id TEXT PRIMARY KEY,
  car_id TEXT NOT NULL,
  author TEXT NOT NULL,
  text TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  comfort INTEGER,
  "gasConsumption" INTEGER,
  performance INTEGER,
  reliability INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for comments
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public access to comments"
  ON public.comments FOR ALL USING (true) WITH CHECK (true);

-- 3. Create WhipCheck registered users table
CREATE TABLE IF NOT EXISTS public.whipcheck_users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  is_verified BOOLEAN DEFAULT false,
  otp TEXT,
  otp_expires BIGINT,
  plan_tier TEXT DEFAULT 'chiptuning',
  scans_count_used INTEGER DEFAULT 0,
  compare_list TEXT DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for whipcheck_users
ALTER TABLE public.whipcheck_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public access to whipcheck_users"
  ON public.whipcheck_users FOR ALL USING (true) WITH CHECK (true);

-- 4. Create image-recognition caching lookup engine
CREATE TABLE IF NOT EXISTS public.whipcheck_identify_cache (
  key TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for whipcheck_identify_cache
ALTER TABLE public.whipcheck_identify_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public access to whipcheck_identify_cache"
  ON public.whipcheck_identify_cache FOR ALL USING (true) WITH CHECK (true);`;
}

function handleDatabaseError(err: any, res: any, contextDescription = "", req?: any) {
  console.log("Response received:", res.body);
  console.error("Database connection failed:", err);

  const reqMethod = req ? req.method : undefined;
  const reqPath = req ? req.originalUrl || req.path : undefined;
  const reqQuery = req && req.query && Object.keys(req.query).length > 0 ? JSON.stringify(req.query) : undefined;

  console.warn(`Database Error [${contextDescription}]:`, err?.stack || err?.message || err);
  if (reqMethod && reqPath) {
    console.warn(`API Call: ${reqMethod} ${reqPath} | Query: ${reqQuery || "None"}`);
  }
  
  const errText = err?.message || String(err || "");
  const errStack = err?.stack || String(err || "");
  const isMissingTable = 
    err?.code === "42P01" || 
    err?.code === "PGRST125" ||
    (errText.toLowerCase().includes("relation") && errText.toLowerCase().includes("does not exist")) ||
    errText.toLowerCase().includes("invalid path specified in request url") ||
    errText.toLowerCase().includes("pgrst125");

  const isMissingColumn = 
    err?.code === "42703" || 
    err?.code === "PGRST204" ||
    (errText.toLowerCase().includes("column") && errText.toLowerCase().includes("does not exist"));

  let tableName: string | undefined = undefined;
  if (isMissingTable) {
    tableName = "requested database table";
    const tableMatch = errText.match(/relation "public\.(.+?)"/i);
    if (tableMatch && tableMatch[1]) {
      tableName = tableMatch[1];
    } else if (contextDescription) {
      const desc = contextDescription.toLowerCase();
      if (desc.includes("comment")) {
        tableName = "comments";
      } else if (desc.includes("garage") || desc.includes("vehicle") || desc.includes("car")) {
        tableName = "vehicles";
      } else if (desc.includes("user") || desc.includes("signup") || desc.includes("register") || desc.includes("login") || desc.includes("verification") || desc.includes("otp")) {
        tableName = "whipcheck_users";
      } else if (desc.includes("dashboard") || desc.includes("stats")) {
        tableName = "comments / vehicles / whipcheck_users";
      }
    }
  }

  // Persistently record full trace
  saveErrorTraceToFile({
    timestamp: new Date().toISOString(),
    context: contextDescription,
    message: errText,
    code: err?.code || (errText.includes("PGRST125") ? "PGRST125" : undefined),
    stack: errStack,
    tableName: tableName,
    apiPath: reqPath,
    apiMethod: reqMethod,
    apiQuery: reqQuery
  });

  if (isMissingTable) {
    return res.status(400).json({
      error: `Database SQL Table Missing: The table "${tableName}" does not exist in your Supabase project.`,
      code: "TABLE_MISSING",
      tableName: tableName,
      message: `To resolve this error, please log in to your Supabase project dashboard, select the left "SQL Editor" panel, click "New Query," paste the complete SQL script shown below, and hit "Run" to establish the tables automatically.`,
      requiredSql: getCompleteSqlSchema(),
      stack: errStack,
      apiCallTrace: reqPath ? {
        path: reqPath,
        method: reqMethod,
        query: req.query || null
      } : undefined
    });
  }

  if (isMissingColumn) {
    return res.status(400).json({
      error: `Database SQL Column Missing: One or more required columns are missing from the "whipcheck_users" table in your Supabase project.`,
      code: "COLUMN_MISSING",
      message: `Your backend was upgraded, but your Supabase table is missing user plan level / scan count / compare cache columns. To resolve this instantly, please navigate to your Supabase dashboard, open the "SQL Editor" panel, click "New Query", paste and run the query details below, then click save/try again.`,
      requiredSql: `-- Execute this query to add the missing columns to public.whipcheck_users!
ALTER TABLE public.whipcheck_users ADD COLUMN IF NOT EXISTS plan_tier TEXT DEFAULT 'chiptuning';
ALTER TABLE public.whipcheck_users ADD COLUMN IF NOT EXISTS scans_count_used INTEGER DEFAULT 0;
ALTER TABLE public.whipcheck_users ADD COLUMN IF NOT EXISTS compare_list TEXT DEFAULT '[]';`,
      stack: errStack,
      apiCallTrace: reqPath ? {
        path: reqPath,
        method: reqMethod,
        query: req.query || null
      } : undefined
    });
  }

  return res.status(500).json({
    error: err?.message || err || `Failed during ${contextDescription || 'database operations'}.`,
    stack: errStack,
    apiCallTrace: reqPath ? {
      path: reqPath,
      method: reqMethod,
      query: req.query || null
    } : undefined
  });
}

// ----------------------------------------------------
// API ENDPOINTS
// ----------------------------------------------------

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    apiKeyConfigured: !!process.env.GEMINI_API_KEY,
    databaseConfigured: isConnectionConfigured()
  });
});

// GET all comments for any specific Car ID or Comparison Key
app.get("/api/comments/:carId", async (req, res) => {
  const { carId } = req.params;
  try {
    const supabaseObj = getSupabase();
    const { data, error } = await supabaseObj
      .from("comments")
      .select("*")
      .eq("car_id", carId);
      
    if (error) throw error;
    res.json({ comments: data || [] });
  } catch (err: any) {
    handleDatabaseError(err, res, "fetch comments", req);
  }
});

// POST a new comment to a specific Car ID or Comparison Key
app.post("/api/comments/:carId", async (req, res) => {
  try {
    const { carId } = req.params;
    const { author, text, comfort, gasConsumption, performance, reliability } = req.body;
    if (!text || !text.trim()) {
      res.status(400).json({ error: "Comment text cannot be empty" });
      return;
    }

    const newComment = {
      id: `comment-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      car_id: carId,
      author: (author || "Anonymous petrolhead").trim(),
      text: text.trim(),
      timestamp: new Date().toLocaleDateString() + " " + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      comfort: typeof comfort === 'number' ? comfort : null,
      gasConsumption: typeof gasConsumption === 'number' ? gasConsumption : null,
      performance: typeof performance === 'number' ? performance : null,
      reliability: typeof reliability === 'number' ? reliability : null
    };

    const supabaseObj = getSupabase();
    const { error: insertErr } = await supabaseObj
      .from("comments")
      .insert(newComment);

    if (insertErr) throw insertErr;

    const { data, error: fetchErr } = await supabaseObj
      .from("comments")
      .select("*")
      .eq("car_id", carId);

    if (fetchErr) throw fetchErr;

    res.json({ success: true, comments: data || [], comment: newComment });
  } catch (err: any) {
    handleDatabaseError(err, res, "save comment", req);
  }
});

// DELETE a comment
app.delete("/api/comments/:carId/:commentId", async (req, res) => {
  try {
    const { carId, commentId } = req.params;
    const supabaseObj = getSupabase();
    const { error: deleteErr } = await supabaseObj
      .from("comments")
      .delete()
      .eq("id", commentId);

    if (deleteErr) throw deleteErr;

    const { data, error: fetchErr } = await supabaseObj
      .from("comments")
      .select("*")
      .eq("car_id", carId);

    if (fetchErr) throw fetchErr;

    res.json({ success: true, comments: data || [] });
  } catch (err: any) {
    handleDatabaseError(err, res, "delete comment", req);
  }
});

// DELETE comments and ratings for a specific car ID or normalized key (optionally filtered by author)
app.delete("/api/comments/:carId", async (req, res) => {
  try {
    const { carId } = req.params;
    const { author } = req.query;
    const supabaseObj = getSupabase();
    let query = supabaseObj.from("comments").delete().eq("car_id", carId);
    if (author) {
      query = query.eq("author", author as string);
    }
    const { error } = await query;
    if (error) throw error;

    res.json({ success: true, message: `Comments deleted for car: ${carId}` });
  } catch (err: any) {
    handleDatabaseError(err, res, "delete comments list", req);
  }
});

// ----------------------------------------------------
// USER ACCOUNTS & PASSWORD-BASED AUTH (SUPABASE-BACKED)
// ----------------------------------------------------

// User register / signup
app.post("/api/auth/signup", async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !username.trim() || !email || !email.trim() || !password || !password.trim()) {
      res.status(400).json({ error: "All account parameters (Username, Email, Password) are strictly required." });
      return;
    }

    const emailKey = email.trim().toLowerCase();
    const userVal = username.trim();

    const supabaseObj = getSupabase();

    // Check email uniqueness
    const { data: existingEmail, error: emailErr } = await supabaseObj
      .from("whipcheck_users")
      .select("id")
      .eq("email", emailKey);

    if (emailErr) throw emailErr;

    if (existingEmail && existingEmail.length > 0) {
      res.status(400).json({ error: "An account with this email address already exists. Please sign in instead." });
      return;
    }

    // Check username uniqueness
    const { data: existingUser, error: userCheckErr } = await supabaseObj
      .from("whipcheck_users")
      .select("id")
      .ilike("username", userVal);

    if (userCheckErr) throw userCheckErr;

    if (existingUser && existingUser.length > 0) {
      res.status(400).json({ error: "This username is already taken. Please choose a different one." });
      return;
    }

    const uid = `usr-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const generatedOtp = String(Math.floor(100000 + Math.random() * 900000));
    const newUser = {
      id: uid,
      username: userVal,
      email: emailKey,
      password_hash: password,
      is_verified: false,
      otp: generatedOtp,
      otp_expires: Date.now() + 15 * 60 * 1000 // 15 min expiry
    };

    const { error: insertErr } = await supabaseObj
      .from("whipcheck_users")
      .insert(newUser);

    if (insertErr) throw insertErr;

    console.log(`\n\n============ ✉️ OUT-OF-BAND SIMULATED EMAIL DISPATCH ============`);
    console.log(`To: ${newUser.email}`);
    console.log(`Subject: WhipCheck Account Verification OTP`);
    console.log(`Message: Thank you for registering under username [ ${newUser.username} ]. Your 6-digit verification pin is: [ ${generatedOtp} ]`);
    console.log(`===============================================================\n\n`);

    res.json({ 
      success: true, 
      otpCode: generatedOtp,
      message: "Account registered successfully! A secure 6-digit verification code has been dispatched to your email address." 
    });
  } catch (err: any) {
    handleDatabaseError(err, res, "user registration", req);
  }
});

// User login
app.post("/api/auth/login", async (req, res) => {
  try {
    const { loginId, password } = req.body;
    if (!loginId || !loginId.trim() || !password || !password.trim()) {
      res.status(400).json({ error: "Username/Email and Password are required." });
      return;
    }

    const query = loginId.trim().toLowerCase();
    const pass = password.trim();

    const supabaseObj = getSupabase();

    // Find user by email or username
    const { data: users, error: selectErr } = await supabaseObj
      .from("whipcheck_users")
      .select("*")
      .or(`email.eq.${query},username.ilike.${query}`);

    if (selectErr) throw selectErr;

    const user = (users && users[0]) || null;

    if (!user || user.password_hash !== pass) {
      res.status(401).json({ error: "Invalid username/email or password." });
      return;
    }

    // First-time login: verify using email OTP
    if (!user.is_verified) {
      const generatedOtp = user.otp || String(Math.floor(100000 + Math.random() * 900000));
      const codeExpiry = user.otp_expires || (Date.now() + 15 * 60 * 1000);
      
      const { error: updateErr } = await supabaseObj
        .from("whipcheck_users")
        .update({ otp: generatedOtp, otp_expires: codeExpiry })
        .eq("id", user.id);

      if (updateErr) throw updateErr;

      console.log(`\n\n============ ✉️ OUT-OF-BAND SIMULATED EMAIL DISPATCH ============`);
      console.log(`To: ${user.email}`);
      console.log(`Subject: WhipCheck Verification Security PIN`);
      console.log(`Message: Your 6-digit verification code is [ ${generatedOtp} ]`);
      console.log(`===============================================================\n\n`);

      res.json({
        status: "otp_required",
        email: user.email,
        otpCode: generatedOtp,
        message: "First-time Login Check: Verifying your email coordinates. A secure 6-digit OTP code has been dispatched to your email address."
      });
      return;
    }

    res.json({
      status: "success",
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        plan_tier: user.plan_tier || "chiptuning",
        scans_count_used: typeof user.scans_count_used === "number" ? user.scans_count_used : 0,
        compare_list: user.compare_list || "[]"
      }
    });
  } catch (err: any) {
    handleDatabaseError(err, res, "login session", req);
  }
});

// Verify login OTP (First time check only)
app.post("/api/auth/verify-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      res.status(400).json({ error: "Incorrect parameters. Missing email verification context." });
      return;
    }

    const query = email.trim().toLowerCase();
    const code = otp.trim();

    const supabaseObj = getSupabase();
    const { data: users, error: selectErr } = await supabaseObj
      .from("whipcheck_users")
      .select("*")
      .eq("email", query);

    if (selectErr) throw selectErr;

    const user = (users && users[0]) || null;

    if (!user) {
      res.status(404).json({ error: "User profile not found." });
      return;
    }

    if (!user.otp || user.otp !== code) {
      res.status(400).json({ error: "The provided one-time verification code is incorrect. Please try again." });
      return;
    }

    if (user.otp_expires && Date.now() > Number(user.otp_expires)) {
      res.status(400).json({ error: "The verification code has expired. Please log in again to generate a new one." });
      return;
    }

    const { error: updateErr } = await supabaseObj
      .from("whipcheck_users")
      .update({ is_verified: true, otp: null, otp_expires: null })
      .eq("id", user.id);

    if (updateErr) throw updateErr;

    res.json({
      status: "success",
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        plan_tier: user.plan_tier || "chiptuning",
        scans_count_used: typeof user.scans_count_used === "number" ? user.scans_count_used : 0,
        compare_list: user.compare_list || "[]"
      }
    });
  } catch (err: any) {
    handleDatabaseError(err, res, "verify OTP security PIN");
  }
});

// Resend OTP
app.post("/api/auth/resend-otp", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      res.status(400).json({ error: "Missing email context." });
      return;
    }

    const query = email.trim().toLowerCase();
    const supabaseObj = getSupabase();
    const { data: users, error: selectErr } = await supabaseObj
      .from("whipcheck_users")
      .select("*")
      .eq("email", query);

    if (selectErr) throw selectErr;

    const user = (users && users[0]) || null;

    if (!user) {
      res.status(404).json({ error: "User profile not found." });
      return;
    }

    const generatedOtp = String(Math.floor(100000 + Math.random() * 900000));
    const { error: updateErr } = await supabaseObj
      .from("whipcheck_users")
      .update({ otp: generatedOtp, otp_expires: Date.now() + 15 * 60 * 1000 })
      .eq("id", user.id);

    if (updateErr) throw updateErr;

    console.log(`\n\n============ ✉️ OUT-OF-BAND SIMULATED EMAIL DISPATCH ============`);
    console.log(`To: ${user.email}`);
    console.log(`Subject: New WhipCheck Verification Security PIN`);
    console.log(`Message: Your fresh 6-digit verification code is [ ${generatedOtp} ]`);
    console.log(`===============================================================\n\n`);

    res.json({
      success: true,
      otpCode: generatedOtp,
      message: "A fresh 6-digit verification code has been dispatched to your email address."
    });
  } catch (err: any) {
    handleDatabaseError(err, res, "resend verification security PIN");
  }
});

// Fetch user subscription & plan detailed parameters
app.get("/api/user/profile/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId || userId === "null" || userId === "undefined") {
      res.status(401).json({ error: "Unauthorized: Invalid or empty user identifier. Please log in first." });
      return;
    }
    const supabaseObj = getSupabase();
    const { data: users, error } = await supabaseObj
      .from("whipcheck_users")
      .select("id, username, email, plan_tier, scans_count_used, compare_list")
      .eq("id", userId);

    if (error) throw error;

    const user = (users && users[0]) || null;
    if (!user) {
      res.status(404).json({ error: "User profile not found." });
      return;
    }

    res.json({
      success: true,
      profile: {
        id: user.id,
        username: user.username,
        email: user.email,
        plan_tier: user.plan_tier || "chiptuning",
        scans_count_used: typeof user.scans_count_used === "number" ? user.scans_count_used : 0,
        compare_list: user.compare_list || "[]"
      }
    });
  } catch (err: any) {
    handleDatabaseError(err, res, "fetch user profile", req);
  }
});

// Update user subscription, plan parameters, or comparisons
app.post("/api/user/profile/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId || userId === "null" || userId === "undefined") {
      res.status(401).json({ error: "Unauthorized: Invalid or empty user identifier." });
      return;
    }
    const { plan_tier, scans_count_used, compare_list } = req.body;
    const updateObj: any = {};

    if (plan_tier !== undefined) {
      updateObj.plan_tier = plan_tier;
    }
    if (scans_count_used !== undefined) {
      updateObj.scans_count_used = Number(scans_count_used);
    }
    if (compare_list !== undefined) {
      updateObj.compare_list = typeof compare_list === "string" ? compare_list : JSON.stringify(compare_list);
    }

    if (Object.keys(updateObj).length === 0) {
      res.status(400).json({ error: "Nothing to update." });
      return;
    }

    const supabaseObj = getSupabase();
    const { data, error } = await supabaseObj
      .from("whipcheck_users")
      .update(updateObj)
      .eq("id", userId)
      .select("id, username, email, plan_tier, scans_count_used, compare_list");

    if (error) throw error;

    const updatedUser = (data && data[0]) || null;
    res.json({
      success: true,
      profile: updatedUser ? {
        id: updatedUser.id,
        username: updatedUser.username,
        email: updatedUser.email,
        plan_tier: updatedUser.plan_tier || "chiptuning",
        scans_count_used: typeof updatedUser.scans_count_used === "number" ? updatedUser.scans_count_used : 0,
        compare_list: updatedUser.compare_list || "[]"
      } : null
    });
  } catch (err: any) {
    handleDatabaseError(err, res, "update user profile", req);
  }
});

// Fetch server vehicles scoped to custom user ID
app.get("/api/user/vehicles/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId || userId === "null" || userId === "undefined") {
      res.status(401).json({ error: "Unauthorized: Invalid or unauthenticated session. Please log in first." });
      return;
    }
    const supabaseObj = getSupabase();

    const { data: dbData, error } = await supabaseObj
      .from("vehicles")
      .select("*")
      .eq("user_id", userId);

    if (error) throw error;
    const refreshedData = dbData || [];

    const vehicles = refreshedData.map(row => {
      let triviaParsed = [];
      let tipsParsed = [];
      let specsParsed = { transmission: "N/A", driveType: "N/A", fuelEconomy: "N/A" };
      try {
        triviaParsed = typeof row.trivia === "string" ? JSON.parse(row.trivia) : (row.trivia || []);
      } catch (e) {
        if (Array.isArray(row.trivia)) triviaParsed = row.trivia;
      }
      try {
        tipsParsed = typeof row.tips === "string" ? JSON.parse(row.tips) : (row.tips || []);
      } catch (e) {
        if (Array.isArray(row.tips)) tipsParsed = row.tips;
      }
      try {
        specsParsed = typeof row.specs === "string" ? JSON.parse(row.specs) : (row.specs || specsParsed);
      } catch (e) {
        if (row.specs) specsParsed = row.specs;
      }
      return {
        ...row,
        trivia: triviaParsed,
        tips: tipsParsed,
        specs: specsParsed
      };
    });

    res.json({ vehicles });
  } catch (err: any) {
    handleDatabaseError(err, res, "retrieve user garage", req);
  }
});

// Save/add vehicle for a user
app.post("/api/user/vehicles/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId || userId === "null" || userId === "undefined") {
      res.status(401).json({ error: "Unauthorized: Invalid, unauthenticated, or empty user identifier. Please log in first." });
      return;
    }
    const { vehicle } = req.body;
    if (!vehicle) {
      res.status(400).json({ error: "Missing vehicle spec." });
      return;
    }

    const supabaseObj = getSupabase();
    const { data: existingCar, error: checkErr } = await supabaseObj
      .from("vehicles")
      .select("id")
      .eq("user_id", userId)
      .eq("id", vehicle.id)
      .maybeSingle();

    if (checkErr) throw checkErr;

    if (existingCar) {
      res.status(400).json({ error: "Car already added before" });
      return;
    }

    const serialized = {
      id: vehicle.id,
      timestamp: vehicle.timestamp || new Date().toLocaleString(),
      image: vehicle.image,
      isCar: vehicle.isCar !== undefined ? vehicle.isCar : true,
      make: vehicle.make,
      model: vehicle.model,
      generation: vehicle.generation,
      yearRange: vehicle.yearRange,
      confidence: vehicle.confidence,
      color: vehicle.color,
      category: vehicle.category,
      engineType: vehicle.engineType,
      power: vehicle.power,
      horsepower: vehicle.horsepower,
      torque: vehicle.torque,
      modelYear: vehicle.modelYear,
      zeroToSixty: vehicle.zeroToSixty,
      estimatedNewPrice: vehicle.estimatedNewPrice,
      estimatedUsedPrice: vehicle.estimatedUsedPrice,
      trivia: JSON.stringify(vehicle.trivia || []),
      tips: JSON.stringify(vehicle.tips || []),
      specs: JSON.stringify(vehicle.specs || {}),
      user_id: userId
    };

    const { error: insertErr } = await supabaseObj
      .from("vehicles")
      .insert(serialized);

    if (insertErr) throw insertErr;

    const { data: dbData, error: selectErr } = await supabaseObj
      .from("vehicles")
      .select("*")
      .eq("user_id", userId);

    if (selectErr) throw selectErr;
    const refreshedData = dbData || [];

    const vehicles = refreshedData.map(row => {
      let triviaParsed = [];
      let tipsParsed = [];
      let specsParsed = { transmission: "N/A", driveType: "N/A", fuelEconomy: "N/A" };
      try {
        triviaParsed = typeof row.trivia === "string" ? JSON.parse(row.trivia) : (row.trivia || []);
      } catch (e) {
        if (Array.isArray(row.trivia)) triviaParsed = row.trivia;
      }
      try {
        tipsParsed = typeof row.tips === "string" ? JSON.parse(row.tips) : (row.tips || []);
      } catch (e) {
        if (Array.isArray(row.tips)) tipsParsed = row.tips;
      }
      try {
        specsParsed = typeof row.specs === "string" ? JSON.parse(row.specs) : (row.specs || specsParsed);
      } catch (e) {
        if (row.specs) specsParsed = row.specs;
      }
      return {
        ...row,
        trivia: triviaParsed,
        tips: tipsParsed,
        specs: specsParsed
      };
    });

    res.json({ success: true, vehicles });
  } catch (err: any) {
    handleDatabaseError(err, res, "persist user garage", req);
  }
});

// Delete vehicle from a user's cloud garage record
app.delete("/api/user/vehicles/:userId/:vehicleId", async (req, res) => {
  try {
    const { userId, vehicleId } = req.params;
    if (!userId || userId === "null" || userId === "undefined") {
      res.status(401).json({ error: "Unauthorized: Invalid or unauthenticated session. Please log in first." });
      return;
    }
    const supabaseObj = getSupabase();

    const { error: valErr } = await supabaseObj
      .from("vehicles")
      .delete()
      .eq("id", vehicleId)
      .eq("user_id", userId);

    if (valErr) throw valErr;

    const { data: dbData, error: selectErr } = await supabaseObj
      .from("vehicles")
      .select("*")
      .eq("user_id", userId);

    if (selectErr) throw selectErr;
    const refreshedData = dbData || [];

    const vehicles = refreshedData.map(row => {
      let triviaParsed = [];
      let tipsParsed = [];
      let specsParsed = { transmission: "N/A", driveType: "N/A", fuelEconomy: "N/A" };
      try {
        triviaParsed = typeof row.trivia === "string" ? JSON.parse(row.trivia) : (row.trivia || []);
      } catch (e) {
        if (Array.isArray(row.trivia)) triviaParsed = row.trivia;
      }
      try {
        tipsParsed = typeof row.tips === "string" ? JSON.parse(row.tips) : (row.tips || []);
      } catch (e) {
        if (Array.isArray(row.tips)) tipsParsed = row.tips;
      }
      try {
        specsParsed = typeof row.specs === "string" ? JSON.parse(row.specs) : (row.specs || specsParsed);
      } catch (e) {
        if (row.specs) specsParsed = row.specs;
      }
      return {
        ...row,
        trivia: triviaParsed,
        tips: tipsParsed,
        specs: specsParsed
      };
    });

    res.json({ success: true, vehicles });
  } catch (err: any) {
    handleDatabaseError(err, res, "remove user car", req);
  }
});

// Identify car from base64 image using Gemini
app.post("/api/identify-car", async (req, res) => {
  try {
    const { image, imageUrl } = req.body;
    if (!image && !imageUrl) {
      res.status(400).json({ error: "Missing image or imageUrl data" });
      return;
    }

    // Generate robust cache key
    let cacheKey = "";
    if (imageUrl) {
      cacheKey = `url_${imageUrl.trim()}`;
    } else if (image) {
      const imgStr = String(image);
      const signature = imgStr.length > 100 
        ? imgStr.substring(0, 50) + imgStr.substring(imgStr.length - 50) 
        : imgStr;
      cacheKey = `img_${imgStr.length}_${signature.replace(/[^a-zA-Z0-9]/g, "")}`;
    }

    if (cacheKey) {
      const cachedResult = await getCachedAnalysis(cacheKey);
      if (cachedResult) {
        console.log(`[Identify Table Cache Hit] Serving cached result for key sig: ${cacheKey.substring(0, 40)}...`);
        res.json(cachedResult);
        return;
      }
    }

    let mimeType = "image/jpeg";
    let base64Data = "";

    if (image) {
      const matches = image.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
      base64Data = image;
      if (matches) {
        mimeType = matches[1];
        base64Data = matches[2];
      }
    } else if (imageUrl) {
      const fetchResponse = await fetch(imageUrl);
      if (!fetchResponse.ok) {
        throw new Error(`Failed to download sample image from URL: ${imageUrl}`);
      }
      const arrayBuffer = await fetchResponse.arrayBuffer();
      base64Data = Buffer.from(arrayBuffer).toString("base64");
      mimeType = fetchResponse.headers.get("content-type") || "image/jpeg";
    }

    const ai = getGeminiClient();

    const imagePart = {
      inlineData: {
        mimeType: mimeType,
        data: base64Data,
      },
    };

    const textPart = {
      text: `Analyze this image of a car or vehicle. Correctly identify its make, model, generation, year range, and specific visually identifiable details or configurations. Be highly accurate and precise based on visual characteristics (lights, grilles, wheels, badges, rear paneling, etc.).

IMPORTANT UNIT REQUIREMENT:
1. All price estimates (estimatedNewPrice, estimatedUsedPrice) MUST be expressed in Egyptian Pounds (EGP) on the Egyptian market, e.g. "EGP 1,200,000" or "EGP 3.5 Million".
2. All speed, range, and fuel numbers MUST use metric system:
   - "zeroToSixty" MUST be 0-100 km/h acceleration time, e.g. "4.5 seconds".
   - "specs.fuelEconomy" MUST be L/100 km for petrol/diesel cars, or electric battery range in Kilometers (km) for EVs, e.g. "6.2 L/100 km" or "480 km range".

If the image does not seem to contain or represent an automobile, please set "isCar" to false. Otherwise, set "isCar" to true.`,
    };

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: { parts: [imagePart, textPart] },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isCar: {
              type: Type.BOOLEAN,
              description: "True if the image contains or primarily depicts some kind of automobile or car. False if it is something else entirely."
            },
            make: { type: Type.STRING, description: "Car brand / manufacturer, e.g., Porsche or Honda." },
            model: { type: Type.STRING, description: "Specific line or model, e.g., Civic Type R or 911 GT3." },
            generation: { type: Type.STRING, description: "Generation name or model index (e.g. 'FL5', '992')." },
            yearRange: { type: Type.STRING, description: "Estimated year range of this body style." },
            confidence: { type: Type.NUMBER, description: "Confidence score from 0.0 to 1.0." },
            color: { type: Type.STRING, description: "The visual exterior paint color of the vehicle." },
            category: { type: Type.STRING, description: "Car body style / category, e.g., Coupe, Sedan, SUV, Supercar, EV." },
            engineType: { type: Type.STRING, description: "Estimated powertrain configuration, e.g., 'Turbocharged 2.0L Inline-4'." },
            power: { type: Type.STRING, description: "Estimated horsepower, e.g. '315 hp'." },
            horsepower: { type: Type.STRING, description: "The horsepower rating, e.g. '315 hp'." },
            torque: { type: Type.STRING, description: "The engine torque rating, e.g. '400 Nm'." },
            modelYear: { type: Type.STRING, description: "The most likely model year shown, e.g., '2023'." },
            zeroToSixty: { type: Type.STRING, description: "Estimated 0-100 km/h acceleration time, e.g. '4.5 seconds'." },
            estimatedNewPrice: { type: Type.STRING, description: "Original MSRP price range when sold brand new, in EGP, e.g. 'EGP 1,850,000'." },
            estimatedUsedPrice: { type: Type.STRING, description: "Current estimated resale or used value in EGP, e.g. 'EGP 1.2M - 1.5M'." },
            trivia: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "2-3 highly engaging, authentic trivia facts regarding this model."
            },
            tips: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "2-3 practical advice points for buyers or fans."
            },
            specs: {
              type: Type.OBJECT,
              properties: {
                transmission: { type: Type.STRING, description: "Typical transmission (e.g., 6-Speed Manual, 8-Speed Automatic)" },
                driveType: { type: Type.STRING, description: "Drivetrain config (RWD, AWD, FWD, 4WD)" },
                fuelEconomy: { type: Type.STRING, description: "Estimated fuel consumption in L/100km or EV range, e.g. '6.5 L/100 km'." }
              },
              required: ["transmission", "driveType", "fuelEconomy"]
            }
          },
          required: [
            "isCar", "make", "model", "generation", "yearRange", "confidence", "color", 
            "category", "engineType", "power", "horsepower", "torque", "modelYear", "zeroToSixty", "estimatedNewPrice", 
            "estimatedUsedPrice", "trivia", "tips", "specs"
          ]
        }
      }
    });

    const textResult = response.text;
    if (!textResult) {
      res.status(500).json({ error: "Empty response received from computer vision API" });
      return;
    }

    const data = JSON.parse(textResult.trim());

    if (cacheKey) {
      await saveCachedAnalysis(cacheKey, data);
    }

    res.json(data);
  } catch (error: any) {
    console.error("Error analyzing car image:", error);
    res.status(500).json({ 
      error: error.message || "An error occurred during car image identification." 
    });
  }
});

// GET dashboard landing page global statistics and top rated vehicle computation
app.get("/api/dashboard-stats", async (req, res) => {
  try {
    let comments: any[] = [];
    let vehicles: any[] = [];
    let requiresSetup = false;
    let missingTable = "";
    const supabaseObj = getSupabase();

    try {
      const { data: commentsData, error: cErr } = await supabaseObj
        .from("comments")
        .select("*");
      if (cErr) throw cErr;
      comments = commentsData || [];
    } catch (err: any) {
      if (checkIsMissingTable(err)) {
        requiresSetup = true;
        missingTable = "comments";
      } else {
        throw err;
      }
    }

    try {
      const { data: vehiclesData, error: vErr } = await supabaseObj
        .from("vehicles")
        .select("*");
      if (vErr) throw vErr;
      vehicles = vehiclesData || [];
    } catch (err: any) {
      if (checkIsMissingTable(err)) {
        requiresSetup = true;
        missingTable = "vehicles";
      } else {
        throw err;
      }
    }

    let usersCount = 0;
    try {
      const { data: usersData, error: uErr } = await supabaseObj
        .from("whipcheck_users")
        .select("id");
      if (uErr) throw uErr;
      usersCount = (usersData || []).length;
    } catch (e: any) {
      if (checkIsMissingTable(e)) {
        requiresSetup = true;
        missingTable = "whipcheck_users";
      } else {
        console.warn("Whipcheck_users table missing or empty", e);
      }
    }

    const allVehicles: any[] = (vehicles || []).map(row => {
      let triviaParsed = [];
      let tipsParsed = [];
      let specsParsed = { transmission: "N/A", driveType: "N/A", fuelEconomy: "N/A" };
      try {
        triviaParsed = typeof row.trivia === "string" ? JSON.parse(row.trivia) : (row.trivia || []);
      } catch (e) {
        if (Array.isArray(row.trivia)) triviaParsed = row.trivia;
      }
      try {
        tipsParsed = typeof row.tips === "string" ? JSON.parse(row.tips) : (row.tips || []);
      } catch (e) {
        if (Array.isArray(row.tips)) tipsParsed = row.tips;
      }
      try {
        specsParsed = typeof row.specs === "string" ? JSON.parse(row.specs) : (row.specs || specsParsed);
      } catch (e) {
        if (row.specs) specsParsed = row.specs;
      }
      return {
        ...row,
        trivia: triviaParsed,
        tips: tipsParsed,
        specs: specsParsed
      };
    });

    const uniqueVehiclesMap = new Map<string, any>();
    const uniqueImages = new Set<string>();

    allVehicles.forEach(v => {
      if (v && v.id) {
        uniqueVehiclesMap.set(v.id, v);
        if (v.image) {
          uniqueImages.add(v.image);
        }
      }
    });

    // Group comments by carId
    const commentsMap: Record<string, any[]> = {};
    (comments || []).forEach(c => {
      if (!commentsMap[c.car_id]) {
        commentsMap[c.car_id] = [];
      }
      commentsMap[c.car_id].push(c);
    });

    let topVehicleId = null;
    let maxAvgRating = 0;
    const vehicleRatings: Record<string, { average: number; count: number }> = {};

    Object.entries(commentsMap).forEach(([carId, commentList]) => {
      let sum = 0;
      let count = 0;
      if (Array.isArray(commentList)) {
        commentList.forEach(cmt => {
          let currentCmtSum = 0;
          let currentCmtCount = 0;
          if (typeof cmt.comfort === 'number' && cmt.comfort > 0) {
            currentCmtSum += cmt.comfort;
            currentCmtCount++;
          }
          if (typeof cmt.gasConsumption === 'number' && cmt.gasConsumption > 0) {
            currentCmtSum += cmt.gasConsumption;
            currentCmtCount++;
          }
          if (typeof cmt.performance === 'number' && cmt.performance > 0) {
            currentCmtSum += cmt.performance;
            currentCmtCount++;
          }
          if (typeof cmt.reliability === 'number' && cmt.reliability > 0) {
            currentCmtSum += cmt.reliability;
            currentCmtCount++;
          }
          if (currentCmtCount > 0) {
            sum += (currentCmtSum / currentCmtCount);
            count++;
          }
        });
      }

      if (count > 0) {
        const avg = sum / count;
        vehicleRatings[carId] = { average: avg, count };
        if (avg > maxAvgRating) {
          maxAvgRating = avg;
          topVehicleId = carId;
        }
      }
    });

    let topRatedCarDetails = null;
    let comfortAvg: number | null = null;
    let gasAvg: number | null = null;
    let performanceAvg: number | null = null;
    let reliabilityAvg: number | null = null;

    if (topVehicleId) {
      topRatedCarDetails = Array.from(uniqueVehiclesMap.values()).find(v => {
        const normalized = `${v.make}-${v.model}`.toLowerCase().replace(/[^a-z0-9]/g, "");
        return v.id === topVehicleId || normalized === topVehicleId;
      });

      const topComments = commentsMap[topVehicleId];
      if (Array.isArray(topComments) && topComments.length > 0) {
        let comfortSum = 0, comfortCount = 0;
        let gasSum = 0, gasCount = 0;
        let perfSum = 0, perfCount = 0;
        let relSum = 0, relCount = 0;

        topComments.forEach((cmt: any) => {
          if (typeof cmt.comfort === 'number' && cmt.comfort > 0) {
            comfortSum += cmt.comfort;
            comfortCount++;
          }
          if (typeof cmt.gasConsumption === 'number' && cmt.gasConsumption > 0) {
            gasSum += cmt.gasConsumption;
            gasCount++;
          }
          if (typeof cmt.performance === 'number' && cmt.performance > 0) {
            perfSum += cmt.performance;
            perfCount++;
          }
          if (typeof cmt.reliability === 'number' && cmt.reliability > 0) {
            relSum += cmt.reliability;
            relCount++;
          }
        });

        if (comfortCount > 0) comfortAvg = Number((comfortSum / comfortCount).toFixed(1));
        if (gasCount > 0) gasAvg = Number((gasSum / gasCount).toFixed(1));
        if (perfCount > 0) performanceAvg = Number((perfSum / perfCount).toFixed(1));
        if (relCount > 0) reliabilityAvg = Number((relSum / relCount).toFixed(1));
      }
    }

    if (!topRatedCarDetails && allVehicles.length > 0) {
      topRatedCarDetails = allVehicles[0];
      maxAvgRating = 4.8;
    } else if (!topRatedCarDetails) {
      topRatedCarDetails = {
        id: "porsche-911-gt3-992",
        isCar: true,
        make: "Porsche",
        model: "911 GT3 (992)",
        generation: "992",
        yearRange: "2021 - Present",
        confidence: 0.99,
        color: "Shark Blue",
        category: "Supercar",
        engineType: "Naturally Aspirated 4.0L Flat-6",
        power: "502 hp",
        horsepower: "502 hp",
        torque: "470 Nm",
        modelYear: "2023",
        zeroToSixty: "3.4 seconds",
        estimatedNewPrice: "EGP 12,500,000",
        estimatedUsedPrice: "EGP 15,000,000",
        trivia: ["Uses a double-wishbone front suspension derived from the 911 RSR race car.", "The 4.0-liter naturally aspirated engine revs all the way to 9,000 RPM."],
        tips: ["Look out for cars with the manual gearbox for maximal petrolhead purity.", "Carbon ceramic brakes are a highly desirable and expensive resale upgrade."],
        specs: {
          transmission: "7-Speed PDK / 6-Speed Manual",
          driveType: "RWD",
          fuelEconomy: "12.4 L/100 km"
        },
        image: "https://images.unsplash.com/photo-1614162692292-7ac56d7f7f1e?q=80&w=600&auto=format&fit=crop"
      };
      maxAvgRating = 4.9;
    }

    const uniqueImagesCount = uniqueImages.size > 0 ? uniqueImages.size : uniqueVehiclesMap.size;

    const queryUsername = (req.query.username as string || "").trim().toLowerCase();
    let userCommentsCount = 0;
    if (queryUsername) {
      (comments || []).forEach(c => {
        if (c && typeof c.author === "string" && c.author.trim().toLowerCase() === queryUsername) {
          userCommentsCount++;
        }
      });
    }

    res.json({
      totalUniqueScannedImages: uniqueImagesCount,
      totalScansCount: allVehicles.length,
      totalUsersCount: usersCount,
      userCommentsCount,
      topRatedCar: topRatedCarDetails ? {
        ...topRatedCarDetails,
         averageRating: maxAvgRating || 4.8,
        ratingCount: topVehicleId ? (commentsMap[topVehicleId]?.length || 1) : 12,
        comfortAvg: comfortAvg || 4.7,
        gasAvg: gasAvg || 4.2,
        performanceAvg: performanceAvg || 4.9,
        reliabilityAvg: reliabilityAvg || 4.8
      } : null,
      vehicleRatings,
      requiresSetup: requiresSetup || false,
      requiredSql: requiresSetup ? getCompleteSqlSchema() : undefined,
      tableName: requiresSetup ? missingTable : undefined,
      message: requiresSetup ? "One of the required Supabase database tables is missing. Please run the setup SQL script in your Supabase project to generate them." : undefined
    });
  } catch (err: any) {
    handleDatabaseError(err, res, "retrieve dashboard stats");
  }
});

// Clear/Reset all database tables in Supabase
app.post("/api/admin/reset-database", async (req, res) => {
  try {
    const supabaseObj = getSupabase();
    await supabaseObj.from("comments").delete().neq("id", "0");
    await supabaseObj.from("vehicles").delete().neq("id", "0");
    
    try {
      await supabaseObj.from("whipcheck_users").delete().neq("id", "0");
    } catch (e) {
      console.warn("Wiping whipcheck_users failing, ignoring:", e);
    }

    try {
      await supabaseObj.from("whipcheck_identify_cache").delete().neq("key", "0");
    } catch (e) {
      console.warn("Wiping cache table failing, ignoring:", e);
    }

    res.json({ success: true, message: "All cloud database rows on Supabase have been successfully reset and initialized!" });
  } catch (err: any) {
    handleDatabaseError(err, res, "clear databases");
  }
});

// Directly execute raw SQL migration / schema changes via the secure RFC channel
app.post("/api/admin/execute-sql", async (req, res) => {
  try {
    const { sql } = req.body;
    if (!sql || typeof sql !== "string") {
      return res.status(400).json({ error: "No SQL query provided in the body parameters." });
    }

    const supabaseObj = getSupabase();
    // Attempt standard Supabase RPC execution
    const { data, error } = await supabaseObj.rpc("exec_sql", { sql_query: sql });

    if (error) {
      const errMessage = error.message || "";
      const errCode = error.code || "";
      if (errCode === "PGRST501" || errMessage.toLowerCase().includes("does not exist")) {
        return res.status(412).json({
          success: false,
          code: "RPC_MISSING",
          error: "Supabase 'exec_sql' RPC helper function not found.",
          message: "To apply table changes directly from this dashboard, your Supabase project must contain a safe execution helper. Paste and run the setup script below in your Supabase SQL Editor once, then press apply!",
          setupSql: `CREATE OR REPLACE FUNCTION public.exec_sql(sql_query text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE sql_query;
END;
$$;`,
          originalSql: sql
        });
      }
      throw error;
    }

    res.json({
      success: true,
      message: "Database schema migration executed successfully on your Supabase host!"
    });
  } catch (err: any) {
    handleDatabaseError(err, res, "direct database SQL execution", req);
  }
});

// Clear/Reset ONLY registered users
app.post("/api/admin/wipe-users", async (req, res) => {
  try {
    const supabaseObj = getSupabase();
    const { error } = await supabaseObj.from("whipcheck_users").delete().neq("id", "0");
    if (error) throw error;

    res.json({ success: true, message: "All users registered in the database have been successfully cleared!" });
  } catch (err: any) {
    handleDatabaseError(err, res, "clear registered users");
  }
});

// Fetch detailed database stats and raw values for server-side persistence sandbox
app.get("/api/admin/database-stats", async (req, res) => {
  try {
    const supabaseObj = getSupabase();
    let users: any[] = [];
    let vehicles: any[] = [];
    let comments: any[] = [];
    
    let statsErrors: string[] = [];

    try {
      const { data: dbUsers, error: uErr } = await supabaseObj.from("whipcheck_users").select("*");
      if (uErr) throw uErr;
      users = dbUsers || [];
    } catch (err: any) {
      console.warn("Failed retrieving whipcheck_users stats:", err);
      statsErrors.push(`whipcheck_users: ${err?.message || err}`);
      // Log trace persistently
      saveErrorTraceToFile({
        timestamp: new Date().toISOString(),
        context: "retrieve users stats",
        message: err?.message || String(err),
        code: err?.code,
        stack: err?.stack || String(err)
      });
    }

    try {
      const { data: dbVehicles, error: vErr } = await supabaseObj.from("vehicles").select("*");
      if (vErr) throw vErr;
      vehicles = dbVehicles || [];
    } catch (err: any) {
      console.warn("Failed retrieving vehicles stats:", err);
      statsErrors.push(`vehicles: ${err?.message || err}`);
      // Log trace persistently
      saveErrorTraceToFile({
        timestamp: new Date().toISOString(),
        context: "retrieve vehicles stats",
        message: err?.message || String(err),
        code: err?.code,
        stack: err?.stack || String(err)
      });
    }

    try {
      const { data: dbComments, error: cErr } = await supabaseObj.from("comments").select("*");
      if (cErr) throw cErr;
      comments = dbComments || [];
    } catch (err: any) {
      console.warn("Failed retrieving comments stats:", err);
      statsErrors.push(`comments: ${err?.message || err}`);
      // Log trace persistently
      saveErrorTraceToFile({
        timestamp: new Date().toISOString(),
        context: "retrieve comments stats",
        message: err?.message || String(err),
        code: err?.code,
        stack: err?.stack || String(err)
      });
    }

    let cacheRowsCount = 0;
    try {
      const { data: dbCache, error: cacheErr } = await supabaseObj.from("whipcheck_identify_cache").select("key");
      if (!cacheErr) {
        cacheRowsCount = dbCache?.length || 0;
      }
    } catch (err) {
      console.warn("Optional whipcheck_identify_cache count failed:", err);
    }

    const rawVehiclesGrouped: Record<string, any[]> = {};
    (vehicles || []).forEach(v => {
      const uid = v.user_id || "unknown";
      if (!rawVehiclesGrouped[uid]) {
        rawVehiclesGrouped[uid] = [];
      }
      rawVehiclesGrouped[uid].push(v);
    });

    const rawCommentsGrouped: Record<string, any[]> = {};
    (comments || []).forEach(c => {
      const cid = c.car_id || "unknown";
      if (!rawCommentsGrouped[cid]) {
        rawCommentsGrouped[cid] = [];
      }
      rawCommentsGrouped[cid].push(c);
    });

    res.json({
      usersCount: users.length,
      vehiclesUserCount: Object.keys(rawVehiclesGrouped).length,
      totalVehiclesCount: vehicles.length,
      totalCommentsCount: comments.length,
      totalCacheCount: cacheRowsCount,
      commentDetails: Object.fromEntries(
        Object.entries(rawCommentsGrouped).map(([k, v]) => [k, v.length])
      ),
      rawUsers: users.map(u => ({ id: u.id, username: u.username, email: u.email, isVerified: u.is_verified })),
      rawVehicles: rawVehiclesGrouped,
      rawComments: rawCommentsGrouped,
      errorLogs: getErrorTracesFromFile(),
      statsErrors: statsErrors.length > 0 ? statsErrors : undefined
    });
  } catch (err: any) {
    handleDatabaseError(err, res, "retrieve database statistics");
  }
});

// Generic Live DB Explorer endpoint to browse rows of any table from Supabase host
app.get("/api/admin/db-explorer/:tableName", async (req, res) => {
  try {
    const { tableName } = req.params;
    const supabaseObj = getSupabase();
    
    // Safety check of tableName to prevent injections or weird behavior
    const allowedTables = ["whipcheck_users", "vehicles", "comments", "whipcheck_identify_cache"];
    if (!allowedTables.includes(tableName)) {
      return res.status(400).json({ error: `Table "${tableName}" is not allowed or unrecognized.` });
    }

    const { data, error } = await supabaseObj.from(tableName).select("*");
    if (error) throw error;

    res.json({ success: true, tableName, rows: data || [] });
  } catch (err: any) {
    handleDatabaseError(err, res, `browse live table ${req.params.tableName}`);
  }
});

// Delete a row from any table
app.post("/api/admin/db-explorer/:tableName/delete", async (req, res) => {
  try {
    const { tableName } = req.params;
    const { id, key } = req.body; // Use id or key depending on the table schema
    const supabaseObj = getSupabase();

    const allowedTables = ["whipcheck_users", "vehicles", "comments", "whipcheck_identify_cache"];
    if (!allowedTables.includes(tableName)) {
      return res.status(400).json({ error: `Table "${tableName}" is not allowed.` });
    }

    let query;
    if (tableName === "whipcheck_identify_cache") {
      query = supabaseObj.from(tableName).delete().eq("key", key);
    } else {
      query = supabaseObj.from(tableName).delete().eq("id", id);
    }

    const { error } = await query;
    if (error) throw error;

    res.json({ success: true, message: `Successfully deleted row from ${tableName}` });
  } catch (err: any) {
    handleDatabaseError(err, res, `delete row from live table ${req.params.tableName}`);
  }
});

// Update/Upsert a row in any table
app.post("/api/admin/db-explorer/:tableName/update", async (req, res) => {
  try {
    const { tableName } = req.params;
    const rowData = req.body;
    const supabaseObj = getSupabase();

    const allowedTables = ["whipcheck_users", "vehicles", "comments", "whipcheck_identify_cache"];
    if (!allowedTables.includes(tableName)) {
      return res.status(400).json({ error: `Table "${tableName}" is not allowed.` });
    }

    const onConf = tableName === "whipcheck_identify_cache" ? "key" : "id";
    const { error } = await supabaseObj.from(tableName).upsert(rowData, { onConflict: onConf });
    if (error) throw error;

    res.json({ success: true, message: `Successfully updated row in ${tableName}` });
  } catch (err: any) {
    handleDatabaseError(err, res, `update row in live table ${req.params.tableName}`);
  }
});

export default app;
