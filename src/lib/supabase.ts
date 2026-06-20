import { createClient } from "@supabase/supabase-js";
import { IdentifiedCar } from "../types";

const isMissingTableError = (err: any): boolean => {
  if (!err) return false;
  const msg = (err.message || String(err)).toLowerCase();
  return (
    err.code === "PGRST125" ||
    (msg.includes("relation") && msg.includes("does not exist")) ||
    msg.includes("invalid path specified in request url") ||
    msg.includes("pgrst125")
  );
};

export const sanitizeSupabaseUrl = (url: string): string => {
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
};

// Get Supabase credentials directly from environment variables ONLY
const rawSupabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
export const activeSupabaseUrl = sanitizeSupabaseUrl(rawSupabaseUrl);
const activeSupabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || "").trim();

export const isSupabaseConfigured = (): boolean => {
  const url = (activeSupabaseUrl || "").trim().toLowerCase();
  const anonKey = (activeSupabaseAnonKey || "").trim();
  
  if (!url || !anonKey) return false;
  if (url === "undefined" || anonKey === "undefined") return false;
  if (!url.startsWith("https://")) return false;
  
  if (
    url.includes("your-project") || 
    url.includes("placeholder") || 
    url.includes("your_") || 
    url.includes("my_") || 
    url.includes("dummy.com") ||
    url.includes("your-supabase-url")
  ) {
    return false;
  }
  
  return true;
};

// Lazy initialization of the Supabase client
export let supabase = isSupabaseConfigured()
  ? createClient(activeSupabaseUrl, activeSupabaseAnonKey)
  : null;

/**
 * Live update connection parameters (stubbed to do nothing as we rely purely on environment variables)
 */
export const updateSupabaseConfig = (url: string, anonKey: string) => {
  console.info("Supabase config dynamic updates are disabled. Running on pure system environments.");
};

/**
 * Retrieve current connection metrics or source identifiers
 */
export const getActiveSupabaseConfig = () => {
  return {
    url: activeSupabaseUrl,
    anonKey: activeSupabaseAnonKey,
    isOverridden: false,
    hasEnvFallback: isSupabaseConfigured()
  };
};


/**
 * Maps a Supabase row back to the TypeScript IdentifiedCar schema
 */
function deserializeRow(row: any): IdentifiedCar {
  let triviaParsed: string[] = [];
  let tipsParsed: string[] = [];
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
    id: row.id,
    timestamp: row.timestamp,
    image: row.image,
    isCar: row.isCar,
    make: row.make,
    model: row.model,
    generation: row.generation,
    yearRange: row.yearRange,
    confidence: Number(row.confidence) || 0,
    color: row.color,
    category: row.category,
    engineType: row.engineType,
    power: row.power,
    horsepower: row.horsepower,
    torque: row.torque,
    modelYear: row.modelYear,
    zeroToSixty: row.zeroToSixty,
    estimatedNewPrice: row.estimatedNewPrice,
    estimatedUsedPrice: row.estimatedUsedPrice,
    trivia: triviaParsed,
    tips: tipsParsed,
    specs: specsParsed,
  };
}

/**
 * Fetch all vehicles from Supabase
 */
export async function fetchSupabaseGarage(userId?: string): Promise<IdentifiedCar[]> {
  if (!supabase) return [];

  let activeUserId = userId || null;
  if (!activeUserId) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        activeUserId = user.id;
      }
    } catch (e) {
      console.warn("Could not retrieve user context on fetch", e);
    }
  }

  try {
    let queryBuilder = supabase.from("vehicles").select("*");
    if (activeUserId) {
      queryBuilder = queryBuilder.eq("user_id", activeUserId);
    } else {
      // Return empty array to prevent leaks from other users when not logged in
      return [];
    }

    const { data, error } = await queryBuilder.order("timestamp", { ascending: false });

    if (error) {
      throw error;
    }

    return (data || []).map(deserializeRow);
  } catch (e: any) {
    if (isMissingTableError(e)) {
      console.warn("Vehicles table is missing.");
      return [];
    }
    throw e;
  }
}

/**
 * Save or overwrite a vehicle in Supabase
 */
export async function saveSupabaseCar(car: IdentifiedCar, customUserId?: string): Promise<void> {
  if (!supabase) return;

  try {
    const serialized = await serializeCar(car, customUserId);
    let { error } = await supabase
      .from("vehicles")
      .upsert(serialized, { onConflict: "id" });

    if (error && (error.message.includes("user_id") || error.message.includes("column") || error.code === "42703")) {
      console.warn("Retrying saveSupabaseCar without user_id column...");
      const { user_id, ...serializedNoUser } = serialized as any;
      const retryRes = await supabase
        .from("vehicles")
        .upsert(serializedNoUser, { onConflict: "id" });
      error = retryRes.error;
    }

    if (error) {
      throw error;
    }
  } catch (e: any) {
    if (isMissingTableError(e)) {
      console.warn("Vehicles table missing during save.");
      return;
    }
    throw e;
  }
}

/**
 * Maps a plain TypeScript vehicle object to the Supabase database shape
 * Scopes to current logged in user ID if available
 */
async function serializeCar(car: IdentifiedCar, customUserId?: string) {
  let userId: string | null = customUserId || null;
  if (!userId && supabase) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        userId = user.id;
      }
    } catch (e) {
      console.warn("Could not retrieve authenticated user ID:", e);
    }
  }

  return {
    id: car.id,
    timestamp: car.timestamp,
    image: car.image,
    isCar: car.isCar,
    make: car.make,
    model: car.model,
    generation: car.generation,
    yearRange: car.yearRange,
    confidence: car.confidence,
    color: car.color,
    category: car.category,
    engineType: car.engineType,
    power: car.power,
    horsepower: car.horsepower,
    torque: car.torque,
    modelYear: car.modelYear,
    zeroToSixty: car.zeroToSixty,
    estimatedNewPrice: car.estimatedNewPrice,
    estimatedUsedPrice: car.estimatedUsedPrice,
    trivia: JSON.stringify(car.trivia),
    tips: JSON.stringify(car.tips),
    specs: JSON.stringify(car.specs),
    ...(userId ? { user_id: userId } : {})
  };
}

/**
 * Sign in/up with OTP (One-Time Password / Login Code sent to email)
 */
export async function sendOtpCode(email: string): Promise<{ error: any }> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim(),
    options: {
      shouldCreateUser: true,
      emailRedirectTo: window.location.origin,
    }
  });
  return { error };
}

/**
 * Verify OTP Code
 */
export async function verifyOtpCode(email: string, token: string): Promise<{ data: any; error: any }> {
  if (!supabase) throw new Error("Supabase is not configured.");
  
  const trimmedToken = token.trim();
  
  // 1. If the user pasted a full Supabase confirmation URL
  if (trimmedToken.includes("http://") || trimmedToken.includes("https://") || trimmedToken.includes("token_hash=") || trimmedToken.includes("code=")) {
    try {
      let parsedUrl: URL;
      if (trimmedToken.startsWith("http://") || trimmedToken.startsWith("https://")) {
        parsedUrl = new URL(trimmedToken);
      } else {
        // Handle partial query strings
        parsedUrl = new URL(`https://dummy.com?${trimmedToken}`);
      }
      
      const tokenHash = parsedUrl.searchParams.get("token_hash");
      const code = parsedUrl.searchParams.get("code");
      const typeParam = parsedUrl.searchParams.get("type") || "signup";
      
      if (tokenHash) {
        // Try both signup and magiclink type verifying the token_hash
        const typesToTry: ("signup" | "magiclink" | "invite" | "email_change")[] = [
          typeParam as any,
          "signup",
          "magiclink"
        ];
        
        let lastError = null;
        for (const currentType of typesToTry) {
          const { data, error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: currentType,
          });
          if (!error) {
            return { data, error: null };
          }
          lastError = error;
        }
        return { data: null, error: lastError };
      }
      
      if (code) {
        // Exchange authorization code for session
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        return { data, error };
      }
      
      // Fallback: If they pasted a URL containing raw token query parameters
      const rawToken = parsedUrl.searchParams.get("token") || parsedUrl.searchParams.get("code") || trimmedToken;
      if (rawToken && rawToken !== trimmedToken) {
        const typesToTry: ("email" | "signup" | "magiclink")[] = ["email", "signup", "magiclink"];
        let lastError = null;
        for (const currentType of typesToTry) {
          const { data, error } = await supabase.auth.verifyOtp({
            email: email.trim(),
            token: rawToken,
            type: currentType,
          });
          if (!error) {
            return { data, error: null };
          }
          lastError = error;
        }
        return { data: null, error: lastError };
      }
    } catch (urlErr) {
      console.warn("Failed to parse link URL, checking as raw token", urlErr);
    }
  }

  // 2. Standard flow: try verifying the raw 6-digit code or pasted token across multiple types
  const typesToTry: ("email" | "signup" | "magiclink")[] = ["email", "signup", "magiclink"];
  let lastError = null;
  
  for (const currentType of typesToTry) {
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: trimmedToken,
        type: currentType,
      });
      
      if (!error) {
        return { data, error: null };
      }
      lastError = error;
    } catch (e: any) {
      lastError = e;
    }
  }
  
  return { data: null, error: lastError };
}

/**
 * Sign in with Social Provider (OAuth)
 */
export async function signInWithSocial(provider: "google" | "github" | "discord") {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: window.location.origin,
    }
  });
  if (error) throw error;
  return data;
}

/**
 * Logout
 */
export async function signOutUser(): Promise<void> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/**
 * Remove a vehicle from Supabase database
 */
export async function removeSupabaseCar(id: string, userId?: string): Promise<void> {
  if (!supabase) return;

  let activeUserId = userId || null;
  if (!activeUserId) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        activeUserId = user.id;
      }
    } catch (e) {
      console.warn("Could not retrieve user context on remove", e);
    }
  }

  try {
    let queryBuilder = supabase.from("vehicles").delete().eq("id", id);
    if (activeUserId) {
      queryBuilder = queryBuilder.eq("user_id", activeUserId);
    }

    const { error } = await queryBuilder;

    if (error) {
      throw error;
    }
  } catch (e: any) {
    if (isMissingTableError(e)) {
      console.warn("Vehicles table missing during remove.");
      return;
    }
    throw e;
  }
}

/**
 * Sync multiple cars to Supabase at once (e.g. during manual cloud backup)
 */
export async function syncLocalGarageToCloud(cars: IdentifiedCar[], userId?: string): Promise<{ successCount: number; errors: string[] }> {
  if (!supabase) throw new Error("Supabase is not configured.");
  if (cars.length === 0) return { successCount: 0, errors: [] };

  const errors: string[] = [];
  let successCount = 0;

  for (const car of cars) {
    try {
      await saveSupabaseCar(car, userId);
      successCount++;
    } catch (e: any) {
      errors.push(`Failed to save ${car.make} ${car.model}: ${e.message || e}`);
    }
  }

  return { successCount, errors };
}

export interface SupabaseHealthCheckResult {
  success: boolean;
  message: string;
  configured: boolean;
  url: string;
  error?: {
    message: string;
    code?: string;
    details?: string;
    hint?: string;
    stack?: string;
  };
}

/**
 * Health check procedure to verify live connection to Supabase database.
 * Returns precise success, configuration state, and full diagnostic error traces for developer triage.
 */
export async function checkSupabaseConnection(): Promise<SupabaseHealthCheckResult> {
  const isConfigured = isSupabaseConfigured();
  if (!isConfigured) {
    return {
      success: false,
      message: "Supabase integration is not active or configured. VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment parameters are missing or invalid in your environment setup.",
      configured: false,
      url: activeSupabaseUrl || "None"
    };
  }

  if (!supabase) {
    return {
      success: false,
      message: "The Supabase client instance failed to initialize cleanly with the provided system credentials.",
      configured: true,
      url: activeSupabaseUrl
    };
  }

  try {
    // Light connection probe to test authorization, network layer, and schema state
    const { data, error } = await supabase
      .from("vehicles")
      .select("id")
      .limit(1);

    if (error) {
      // If it is just a missing table error, this still proves that credentials and server handshake are fully functional!
      if (isMissingTableError(error)) {
        return {
          success: true,
          message: "Handshake Successful! Credentials are correct and connection is established. Note: The 'vehicles' table has not been created in this database yet. You can run the setup scripts in the SQL tab.",
          configured: true,
          url: activeSupabaseUrl,
          error: {
            message: error.message,
            code: error.code,
            details: error.details,
            hint: error.hint
          }
        };
      }
      
      // Other database / authority errors mean connection or project configuration fails
      return {
        success: false,
        message: `Handshake Failed: ${error.message || "Unknown database rejection"}`,
        configured: true,
        url: activeSupabaseUrl,
        error: {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint
        }
      };
    }

    return {
      success: true,
      message: "Connection fully operational. Secure gateway is connected and 'vehicles' table is verified.",
      configured: true,
      url: activeSupabaseUrl
    };
  } catch (e: any) {
    return {
      success: false,
      value: null,
      message: `Direct TCP/HTTPS connection failure: ${e.message || e}`,
      configured: true,
      url: activeSupabaseUrl,
      error: {
        message: e.message || String(e),
        stack: e.stack
      }
    } as any;
  }
}
