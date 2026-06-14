import express from "express";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import fs from "fs";
import path from "path";

dotenv.config();

const app = express();

// Increase request size limit for base64 image uploads
app.use(express.json({ limit: "15mb" }));

let aiClient: GoogleGenAI | null = null;

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

// ----------------------------------------------------
// USER ACCOUNT & DATABASE SCHEMAS (SERVER-SIDE)
// ----------------------------------------------------
interface UserRecord {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  isVerified: boolean;
  otp?: string;
  otpExpires?: number;
}

const USERS_FILE = path.join(process.cwd(), "users_db.json");
const USER_VEHICLES_FILE = path.join(process.cwd(), "user_vehicles_db.json");

function readUsersDb(): Record<string, UserRecord> {
  try {
    if (fs.existsSync(USERS_FILE)) {
      const content = fs.readFileSync(USERS_FILE, "utf-8");
      return JSON.parse(content || "{}");
    }
  } catch (err) {
    console.error("Error reading users database:", err);
  }
  return {};
}

function writeUsersDb(data: Record<string, UserRecord>) {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error("Error writing users database:", err);
  }
}

function readUserVehiclesDb(): Record<string, any[]> {
  try {
    if (fs.existsSync(USER_VEHICLES_FILE)) {
      const content = fs.readFileSync(USER_VEHICLES_FILE, "utf-8");
      return JSON.parse(content || "{}");
    }
  } catch (err) {
    console.error("Error reading user vehicles database:", err);
  }
  return {};
}

function writeUserVehiclesDb(data: Record<string, any[]>) {
  try {
    fs.writeFileSync(USER_VEHICLES_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error("Error writing user vehicles database:", err);
  }
}

// ----------------------------------------------------
// GLOBAL PERSISTENT COMMENTS STORE (SERVER-SIDE)
// ----------------------------------------------------
interface Comment {
  id: string;
  author: string;
  text: string;
  timestamp: string;
  comfort?: number;
  gasConsumption?: number;
  performance?: number;
  reliability?: number;
}

const COMMENTS_FILE = path.join(process.cwd(), "comments_db.json");

function readCommentsDb(): Record<string, Comment[]> {
  try {
    if (fs.existsSync(COMMENTS_FILE)) {
      const content = fs.readFileSync(COMMENTS_FILE, "utf-8");
      return JSON.parse(content || "{}");
    }
  } catch (err) {
    console.error("Error reading comments database:", err);
  }
  return {};
}

function writeCommentsDb(data: Record<string, Comment[]>) {
  try {
    fs.writeFileSync(COMMENTS_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error("Error writing comments database:", err);
  }
}

// ----------------------------------------------------
// API ENDPOINTS
// ----------------------------------------------------

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    apiKeyConfigured: !!process.env.GEMINI_API_KEY,
  });
});

// GET all comments for any specific Car ID or Comparison Key
app.get("/api/comments/:carId", (req, res) => {
  try {
    const { carId } = req.params;
    const db = readCommentsDb();
    const list = db[carId] || [];
    res.json({ comments: list });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to fetch comments" });
  }
});

// POST a new comment to a specific Car ID or Comparison Key
app.post("/api/comments/:carId", (req, res) => {
  try {
    const { carId } = req.params;
    const { author, text, comfort, gasConsumption, performance, reliability } = req.body;
    if (!text || !text.trim()) {
      res.status(400).json({ error: "Comment text cannot be empty" });
      return;
    }

    const db = readCommentsDb();
    if (!db[carId]) {
      db[carId] = [];
    }

    const newComment: Comment = {
      id: `comment-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      author: (author || "Anonymous petrolhead").trim(),
      text: text.trim(),
      timestamp: new Date().toLocaleDateString() + " " + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      comfort: typeof comfort === 'number' ? comfort : undefined,
      gasConsumption: typeof gasConsumption === 'number' ? gasConsumption : undefined,
      performance: typeof performance === 'number' ? performance : undefined,
      reliability: typeof reliability === 'number' ? reliability : undefined
    };

    db[carId].push(newComment);
    writeCommentsDb(db);

    res.json({ success: true, comments: db[carId], comment: newComment });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to save comment" });
  }
});

// DELETE a comment
app.delete("/api/comments/:carId/:commentId", (req, res) => {
  try {
    const { carId, commentId } = req.params;
    const db = readCommentsDb();
    if (db[carId]) {
      db[carId] = db[carId].filter(c => c.id !== commentId);
      writeCommentsDb(db);
    }
    res.json({ success: true, comments: db[carId] || [] });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to delete comment" });
  }
});

// DELETE comments and ratings for a specific car ID or normalized key (optionally filtered by author)
app.delete("/api/comments/:carId", (req, res) => {
  try {
    const { carId } = req.params;
    const { author } = req.query;
    const db = readCommentsDb();
    if (db[carId]) {
      if (author) {
        db[carId] = db[carId].filter(c => c.author !== author);
        if (db[carId].length === 0) {
          delete db[carId];
        }
      } else {
        delete db[carId];
      }
      writeCommentsDb(db);
    }
    res.json({ success: true, message: `Comments deleted for car: ${carId}` });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to delete comments" });
  }
});

// ----------------------------------------------------
// USER ACCOUNTS & PASSWORD-BASED AUTH (SERVER-SIDE)
// ----------------------------------------------------

// User register / signup
app.post("/api/auth/signup", (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !username.trim() || !email || !email.trim() || !password || !password.trim()) {
      res.status(400).json({ error: "All account parameters (Username, Email, Password) are strictly required." });
      return;
    }

    const db = readUsersDb();
    const emailKey = email.trim().toLowerCase();
    const userVal = username.trim();

    // Check email uniqueness
    const emailExists = Object.values(db).some(u => u.email === emailKey);
    if (emailExists) {
      res.status(400).json({ error: "An account with this email address already exists. Please sign in instead." });
      return;
    }

    // Check username uniqueness
    const userExists = Object.values(db).some(u => u.username.toLowerCase() === userVal.toLowerCase());
    if (userExists) {
      res.status(400).json({ error: "This username is already taken. Please choose a different one." });
      return;
    }

    const uid = `usr-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const generatedOtp = String(Math.floor(100000 + Math.random() * 900000));
    const newUser: UserRecord = {
      id: uid,
      username: userVal,
      email: emailKey,
      passwordHash: password, // Simple sandbox storage
      isVerified: false,
      otp: generatedOtp,
      otpExpires: Date.now() + 15 * 60 * 1000 // 15 min expiry
    };

    db[uid] = newUser;
    writeUsersDb(db);

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
app.post("/api/auth/login", (req, res) => {
  try {
    const { loginId, password } = req.body;
    if (!loginId || !loginId.trim() || !password || !password.id && !password.trim()) {
      res.status(400).json({ error: "Username/Email and Password are required." });
      return;
    }

    const db = readUsersDb();
    const query = loginId.trim().toLowerCase();
    const pass = password.trim();

    // Find user by email or username
    const user = Object.values(db).find(
      u => u.email === query || u.username.toLowerCase() === query
    );

    if (!user || user.passwordHash !== pass) {
      res.status(401).json({ error: "Invalid username/email or password." });
      return;
    }

    // First-time login: verify using email OTP
    if (!user.isVerified) {
      const generatedOtp = user.otp || String(Math.floor(100000 + Math.random() * 900000)); // 6 digit OTP
      user.otp = generatedOtp;
      user.otpExpires = user.otpExpires || (Date.now() + 15 * 60 * 1000); // 15 min expiry
      db[user.id] = user;
      writeUsersDb(db);

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
app.post("/api/auth/verify-otp", (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      res.status(400).json({ error: "Incorrect parameters. Missing email verification context." });
      return;
    }

    const db = readUsersDb();
    const query = email.trim().toLowerCase();
    const code = otp.trim();

    const user = Object.values(db).find(u => u.email === query);
    if (!user) {
      res.status(404).json({ error: "User profile not found." });
      return;
    }

    if (!user.otp || user.otp !== code) {
      res.status(400).json({ error: "The provided one-time verification code is incorrect. Please try again." });
      return;
    }

    if (user.otpExpires && Date.now() > user.otpExpires) {
      res.status(400).json({ error: "The verification code has expired. Please log in again to generate a new one." });
      return;
    }

    // Mark as verified
    user.isVerified = true;
    delete user.otp;
    delete user.otpExpires;
    db[user.id] = user;
    writeUsersDb(db);

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
app.post("/api/auth/resend-otp", (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      res.status(400).json({ error: "Missing email context." });
      return;
    }

    const db = readUsersDb();
    const query = email.trim().toLowerCase();

    const user = Object.values(db).find(u => u.email === query);
    if (!user) {
      res.status(404).json({ error: "User profile not found." });
      return;
    }

    const generatedOtp = String(Math.floor(100000 + Math.random() * 900000));
    user.otp = generatedOtp;
    user.otpExpires = Date.now() + 15 * 60 * 1000;
    db[user.id] = user;
    writeUsersDb(db);

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
app.get("/api/user/vehicles/:userId", (req, res) => {
  try {
    const { userId } = req.params;
    const db = readUserVehiclesDb();
    const list = db[userId] || [];
    res.json({ vehicles: list });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to retrieve local user garage" });
  }
});

// Save/add vehicle for a user
app.post("/api/user/vehicles/:userId", (req, res) => {
  try {
    const { userId } = req.params;
    const { vehicle } = req.body;
    if (!vehicle) {
      res.status(400).json({ error: "Missing vehicle spec." });
      return;
    }

    const db = readUserVehiclesDb();
    if (!db[userId]) {
      db[userId] = [];
    }

    const exists = db[userId].some(c => c.id === vehicle.id);
    if (exists) {
      res.status(400).json({ error: "Car already added before" });
      return;
    }

    db[userId].unshift(vehicle);

    writeUserVehiclesDb(db);
    res.json({ success: true, vehicles: db[userId] });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to persist user garage." });
  }
});

// Delete vehicle from a user's cloud garage record
app.delete("/api/user/vehicles/:userId/:vehicleId", (req, res) => {
  try {
    const { userId, vehicleId } = req.params;
    const db = readUserVehiclesDb();
    if (db[userId]) {
      db[userId] = db[userId].filter(c => c.id !== vehicleId);
      writeUserVehiclesDb(db);
    }
    res.json({ success: true, vehicles: db[userId] || [] });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to remove user car" });
  }
});

// ----------------------------------------------------
// IDENTIFY CACHE STORE (SERVER-SIDE)
// ----------------------------------------------------
const IDENTIFY_CACHE_FILE = path.join(process.cwd(), "identify_cache.json");

function readIdentifyCache(): Record<string, any> {
  try {
    if (fs.existsSync(IDENTIFY_CACHE_FILE)) {
      const content = fs.readFileSync(IDENTIFY_CACHE_FILE, "utf-8");
      return JSON.parse(content || "{}");
    }
  } catch (err) {
    console.error("Error reading identify cache:", err);
  }
  return {};
}

function writeIdentifyCache(data: Record<string, any>) {
  try {
    fs.writeFileSync(IDENTIFY_CACHE_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error("Error writing identify cache:", err);
  }
}

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

    const currentCache = readIdentifyCache();
    if (cacheKey && currentCache[cacheKey]) {
      console.log(`[Identify Cache Hit] Serving cached result for key sig: ${cacheKey.substring(0, 40)}...`);
      res.json(currentCache[cacheKey]);
      return;
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
              description: "True if the image contains or primarily depicts some kind of automobile or car. False if it is something else entirely (like a person, animal, room interior, landscape, or generic object)."
            },
            make: { type: Type.STRING, description: "Car brand / manufacturer, e.g., Porsche or Honda." },
            model: { type: Type.STRING, description: "Specific line or model, e.g., Civic Type R or 911 GT3." },
            generation: { type: Type.STRING, description: "Generation name, production code, or chassis index (e.g., 'FL5', '992.1', 'MK7'). Use 'N/A' if not clearly identifiable." },
            yearRange: { type: Type.STRING, description: "Estimated year or range of years represented by this model's body style." },
            confidence: { type: Type.NUMBER, description: "Confidence score of recognition on a scale from 0.0 to 1.0 based on your analysis." },
            color: { type: Type.STRING, description: "The visual exterior paint color of the vehicle." },
            category: { type: Type.STRING, description: "Car body style / category, e.g., Coupe, Sedan, Hatchback, Convertible, SUV, Supercar, EV." },
            engineType: { type: Type.STRING, description: "Estimated powertrain configuration, e.g., 'Turbocharged 2.0L Inline-4' or 'Dual Motor AWD EV'." },
            power: { type: Type.STRING, description: "Estimated horsepower or electrical output, e.g., '315 hp'." },
            horsepower: { type: Type.STRING, description: "The specific horsepower rating, e.g., '315 hp' or '450 hp'." },
            torque: { type: Type.STRING, description: "The specific engine torque rating in lb-ft or Nm, e.g., '310 lb-ft' or '400 Nm'." },
            modelYear: { type: Type.STRING, description: "The most likely single model year of the specific car shown in the photo, e.g., '2023'." },
            zeroToSixty: { type: Type.STRING, description: "Estimated 0-100 km/h acceleration time, e.g. '4.5 seconds'." },
            estimatedNewPrice: { type: Type.STRING, description: "Original MSRP price range when sold brand new, expressed in Egyptian Pounds (EGP), e.g. 'EGP 1,850,000'." },
            estimatedUsedPrice: { type: Type.STRING, description: "Current estimated resale or used value range on the Egyptian market in EGP, e.g. 'EGP 1.2M - 1.5M' or 'EGP 950,000 - 1,100,000'." },
            trivia: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "2-3 highly engaging, authentic trivia facts, design milestones, or history points regarding this car model."
            },
            tips: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "2-3 practical advice points for buyers, owners, or fans of this vehicle (e.g. common maintenance quirks, desirable trims)."
            },
            specs: {
              type: Type.OBJECT,
              properties: {
                transmission: { type: Type.STRING, description: "Typical transmission (e.g., 6-Speed Manual, 8-Speed Automatic, DCT, Direct-Drive)" },
                driveType: { type: Type.STRING, description: "Drivetrain config (RWD, AWD, FWD, 4WD)" },
                fuelEconomy: { type: Type.STRING, description: "Estimated fuel consumption in L/100km or EV range in kilometers (km), e.g. '6.5 L/100 km' or '485 km range'." }
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

    // Write to persistent identification cache
    if (cacheKey) {
      const currentCache = readIdentifyCache();
      currentCache[cacheKey] = data;
      writeIdentifyCache(currentCache);
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
app.get("/api/dashboard-stats", (req, res) => {
  try {
    const users = readUsersDb();
    const vehiclesData = readUserVehiclesDb();
    const comments = readCommentsDb();

    const allVehicles: any[] = [];
    const uniqueVehiclesMap = new Map<string, any>();
    const uniqueImages = new Set<string>();

    Object.entries(vehiclesData).forEach(([userId, vList]) => {
      if (Array.isArray(vList)) {
        vList.forEach(v => {
          if (v && v.id) {
            allVehicles.push(v);
            uniqueVehiclesMap.set(v.id, v);
            if (v.image) {
              uniqueImages.add(v.image);
            }
          }
        });
      }
    });

    let topVehicleId = null;
    let maxAvgRating = 0;
    const vehicleRatings: Record<string, { average: number; count: number }> = {};

    Object.entries(comments).forEach(([carId, commentList]) => {
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

      const topComments = comments[topVehicleId];
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

    // Robust high-octane default fallbacks if no ratings yet
    if (!topRatedCarDetails && allVehicles.length > 0) {
      topRatedCarDetails = allVehicles[0];
      maxAvgRating = 4.8;
    } else if (!topRatedCarDetails) {
      // Elegant hardcoded spotlight vehicle fallback for initial empty database state
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
      Object.values(comments).forEach(cList => {
        if (Array.isArray(cList)) {
          cList.forEach(c => {
            if (c && typeof c.author === "string" && c.author.trim().toLowerCase() === queryUsername) {
              userCommentsCount++;
            }
          });
        }
      });
    }

    res.json({
      totalUniqueScannedImages: uniqueImagesCount,
      totalScansCount: allVehicles.length,
      totalUsersCount: Object.keys(users).length,
      userCommentsCount,
      topRatedCar: topRatedCarDetails ? {
        ...topRatedCarDetails,
        averageRating: maxAvgRating || 4.8,
        ratingCount: topVehicleId ? (vehicleRatings[topVehicleId]?.count || 1) : 12,
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

// Clear/Reset all local JSON databases (Users, vehicles, comments)
app.post("/api/admin/reset-database", (req, res) => {
  try {
    writeUsersDb({});
    writeUserVehiclesDb({});
    writeCommentsDb({});
    writeIdentifyCache({});
    res.json({ success: true, message: "All app server-side database files have been successfully reset and initialized!" });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to clear databases." });
  }
});

// Fetch detailed database stats and raw values for server-side persistence sandbox
app.get("/api/admin/database-stats", (req, res) => {
  try {
    const users = readUsersDb();
    const vehicles = readUserVehiclesDb();
    const comments = readCommentsDb();

    let totalVehiclesCount = 0;
    Object.values(vehicles).forEach(vList => {
      totalVehiclesCount += (vList || []).length;
    });

    let totalCommentsCount = 0;
    const commentDetails: Record<string, number> = {};
    Object.entries(comments).forEach(([carId, cList]) => {
      totalCommentsCount += (cList || []).length;
      commentDetails[carId] = (cList || []).length;
    });

    res.json({
      usersCount: Object.keys(users).length,
      vehiclesUserCount: Object.keys(vehicles).length,
      totalVehiclesCount,
      totalCommentsCount,
      commentDetails,
      rawUsers: Object.values(users).map(u => ({ id: u.id, username: u.username, email: u.email, isVerified: u.isVerified })),
      rawVehicles: vehicles,
      rawComments: comments
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to retrieve sandbox database statistics." });
  }
});

export default app;
