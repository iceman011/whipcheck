import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

dotenv.config();

const app = express();
const PORT = 3000;

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
// API ENDPOINTS
// ----------------------------------------------------

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    apiKeyConfigured: !!process.env.GEMINI_API_KEY,
  });
});

// Identify car from base64 image using Gemini
app.post("/api/identify-car", async (req, res) => {
  try {
    const { image, imageUrl } = req.body;
    if (!image && !imageUrl) {
      res.status(400).json({ error: "Missing image or imageUrl data" });
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
    res.json(data);
  } catch (error: any) {
    console.error("Error analyzing car image:", error);
    res.status(500).json({ 
      error: error.message || "An error occurred during car image identification." 
    });
  }
});

// ----------------------------------------------------
// VITE MIDDLEWARE SETUP
// ----------------------------------------------------

async function setupServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server starting on http://localhost:${PORT}`);
  });
}

setupServer();
