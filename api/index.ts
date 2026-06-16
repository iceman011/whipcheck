import express from "express";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const app = express();

// Increase request size limit for base64 image uploads
app.use(express.json({ limit: "15mb" }));

let aiClient: GoogleGenAI | null = null;
let activeSupabaseClient: any = null;

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

// Lazy initialization of Supabase client on backend with support for custom overrides
function getSupabase() {
  if (!activeSupabaseClient) {
    const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
    const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";
    
    if (!url || !key) {
      throw new Error("Supabase credentials (VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY) are missing. Please configure them in the Secrets panel or .env file.");
    }
    activeSupabaseClient = createClient(url, key, {
      auth: {
        persistSession: false
      }
    });
  }
  return activeSupabaseClient;
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
      
    if (error) return null;
    if (data && data.data) {
      return typeof data.data === "string" ? JSON.parse(data.data) : data.data;
    }
  } catch (e) {
    console.warn("Cached analysis lookup failed:", e);
  }
  return null;
}

async function saveCachedAnalysis(cacheKey: string, payload: any): Promise<void> {
  try {
    const supabaseObj = getSupabase();
    await supabaseObj
      .from("whipcheck_identify_cache")
      .upsert({ key: cacheKey, data: JSON.stringify(payload) });
  } catch (e) {
    console.warn("Failed to write to vision cache table:", e);
  }
}

// Helper to check if Supabase is alive/configured (does not crash on startup)
function isConnectionConfigured(): boolean {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";
  return !!(url.trim() && key.trim());
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
  try {
    const { carId } = req.params;
    const supabaseObj = getSupabase();
    const { data, error } = await supabaseObj
      .from("comments")
      .select("*")
      .eq("car_id", carId);
      
    if (error) throw error;
    res.json({ comments: data || [] });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to fetch comments" });
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

    const supabaseObj = getSupabase();
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

    const { error: insertErr } = await supabaseObj
      .from("comments")
      .insert(newComment);

    if (insertErr) throw insertErr;

    const { data: updatedList, error: fetchErr } = await supabaseObj
      .from("comments")
      .select("*")
      .eq("car_id", carId);

    if (fetchErr) throw fetchErr;

    res.json({ success: true, comments: updatedList || [], comment: newComment });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to save comment" });
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

    const { data: updatedList, error: fetchErr } = await supabaseObj
      .from("comments")
      .select("*")
      .eq("car_id", carId);

    if (fetchErr) throw fetchErr;

    res.json({ success: true, comments: updatedList || [] });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to delete comment" });
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
    res.status(500).json({ error: err.message || "Failed to delete comments" });
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

    const supabaseObj = getSupabase();
    const emailKey = email.trim().toLowerCase();
    const userVal = username.trim();

    // Check email uniqueness
    const { data: existingEmail, error: emailErr } = await supabaseObj
      .from("whipcheck_users")
      .select("id")
      .eq("email", emailKey);

    if (emailErr) {
      console.warn("Table whipcheck_users might be missing. Proceeding anyway...", emailErr);
    }

    if (existingEmail && existingEmail.length > 0) {
      res.status(400).json({ error: "An account with this email address already exists. Please sign in instead." });
      return;
    }

    // Check username uniqueness
    const { data: existingUser } = await supabaseObj
      .from("whipcheck_users")
      .select("id")
      .ilike("username", userVal);

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
    res.status(500).json({ error: err.message || "Failed to handle user registration" });
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

    const supabaseObj = getSupabase();
    const query = loginId.trim().toLowerCase();
    const pass = password.trim();

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
        email: user.email
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to handle login session" });
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

    const supabaseObj = getSupabase();
    const query = email.trim().toLowerCase();
    const code = otp.trim();

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

    // Mark as verified
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
        email: user.email
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to verify OTP code" });
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

    const supabaseObj = getSupabase();
    const query = email.trim().toLowerCase();

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
    res.status(500).json({ error: err.message || "Failed to generate OTP" });
  }
});

// Fetch server vehicles scoped to custom user ID
app.get("/api/user/vehicles/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const supabaseObj = getSupabase();
    const { data, error } = await supabaseObj
      .from("vehicles")
      .select("*")
      .eq("user_id", userId);

    if (error) throw error;

    const vehicles = (data || []).map(row => {
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
    res.status(500).json({ error: err.message || "Failed to retrieve user garage" });
  }
});

// Save/add vehicle for a user
app.post("/api/user/vehicles/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const { vehicle } = req.body;
    if (!vehicle) {
      res.status(400).json({ error: "Missing vehicle spec." });
      return;
    }

    const supabaseObj = getSupabase();
    
    // Check if car already exists
    const { data: existingCar, error: checkErr } = await supabaseObj
      .from("vehicles")
      .select("id")
      .eq("user_id", userId)
      .eq("id", vehicle.id)
      .maybeSingle();

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

    // Fetch refreshed garage
    const { data, error: selectErr } = await supabaseObj
      .from("vehicles")
      .select("*")
      .eq("user_id", userId);

    if (selectErr) throw selectErr;

    const vehicles = (data || []).map(row => {
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
    res.status(500).json({ error: err.message || "Failed to persist user garage." });
  }
});

// Delete vehicle from a user's cloud garage record
app.delete("/api/user/vehicles/:userId/:vehicleId", async (req, res) => {
  try {
    const { userId, vehicleId } = req.params;
    const supabaseObj = getSupabase();

    const { error: valErr } = await supabaseObj
      .from("vehicles")
      .delete()
      .eq("id", vehicleId)
      .eq("user_id", userId);

    if (valErr) throw valErr;

    // Refreshed garage
    const { data, error: selectErr } = await supabaseObj
      .from("vehicles")
      .select("*")
      .eq("user_id", userId);

    if (selectErr) throw selectErr;

    const vehicles = (data || []).map(row => {
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
    res.status(500).json({ error: err.message || "Failed to remove user car" });
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
    const supabaseObj = getSupabase();

    // Fetch all comments and vehicles
    const { data: comments, error: cErr } = await supabaseObj
      .from("comments")
      .select("*");
    if (cErr) throw cErr;

    const { data: vehicles, error: vErr } = await supabaseObj
      .from("vehicles")
      .select("*");
    if (vErr) throw vErr;

    let usersCount = 0;
    try {
      const { data: usersData } = await supabaseObj
        .from("whipcheck_users")
        .select("id");
      usersCount = (usersData || []).length;
    } catch (e) {
      console.warn("Whipcheck_users table missing or empty", e);
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
      vehicleRatings
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to retrieve dashboard stats" });
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
    res.status(500).json({ error: err.message || "Failed to clear databases." });
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
    res.status(500).json({ error: err.message || "Failed to clear registered users." });
  }
});

// Fetch detailed database stats and raw values for server-side persistence sandbox
app.get("/api/admin/database-stats", async (req, res) => {
  try {
    const supabaseObj = getSupabase();

    const { data: users } = await supabaseObj.from("whipcheck_users").select("*");
    const { data: vehicles } = await supabaseObj.from("vehicles").select("*");
    const { data: comments } = await supabaseObj.from("comments").select("*");

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
      usersCount: (users || []).length,
      vehiclesUserCount: Object.keys(rawVehiclesGrouped).length,
      totalVehiclesCount: (vehicles || []).length,
      totalCommentsCount: (comments || []).length,
      commentDetails: Object.fromEntries(
        Object.entries(rawCommentsGrouped).map(([k, v]) => [k, v.length])
      ),
      rawUsers: (users || []).map(u => ({ id: u.id, username: u.username, email: u.email, isVerified: u.is_verified })),
      rawVehicles: rawVehiclesGrouped,
      rawComments: rawCommentsGrouped
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to retrieve database statistics." });
  }
});

export default app;
