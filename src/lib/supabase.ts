import { createClient } from "@supabase/supabase-js";
import { IdentifiedCar } from "../types";

// Get Supabase credentials dynamically, optionally fallback to localStorage overrides
let activeSupabaseUrl = localStorage.getItem("whipcheck_supabase_url") || import.meta.env.VITE_SUPABASE_URL || "";
let activeSupabaseAnonKey = localStorage.getItem("whipcheck_supabase_anon_key") || import.meta.env.VITE_SUPABASE_ANON_KEY || "";

export const isSupabaseConfigured = (): boolean => {
  return activeSupabaseUrl.trim() !== "" && activeSupabaseAnonKey.trim() !== "";
};

// Lazy initialization of the Supabase client
export let supabase = isSupabaseConfigured()
  ? createClient(activeSupabaseUrl, activeSupabaseAnonKey)
  : null;

/**
 * Live update connection parameters and re-initialize the client at runtime
 */
export const updateSupabaseConfig = (url: string, anonKey: string) => {
  const cleanUrl = (url || "").trim();
  const cleanKey = (anonKey || "").trim();

  if (cleanUrl) {
    localStorage.setItem("whipcheck_supabase_url", cleanUrl);
  } else {
    localStorage.removeItem("whipcheck_supabase_url");
  }

  if (cleanKey) {
    localStorage.setItem("whipcheck_supabase_anon_key", cleanKey);
  } else {
    localStorage.removeItem("whipcheck_supabase_anon_key");
  }

  activeSupabaseUrl = cleanUrl || import.meta.env.VITE_SUPABASE_URL || "";
  activeSupabaseAnonKey = cleanKey || import.meta.env.VITE_SUPABASE_ANON_KEY || "";

  if (isSupabaseConfigured()) {
    supabase = createClient(activeSupabaseUrl, activeSupabaseAnonKey);
  } else {
    supabase = null;
  }
};

/**
 * Retrieve current connection metrics or source identifiers
 */
export const getActiveSupabaseConfig = () => {
  return {
    url: activeSupabaseUrl,
    anonKey: activeSupabaseAnonKey,
    isOverridden: !!localStorage.getItem("whipcheck_supabase_url"),
    hasEnvFallback: !!(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY)
  };
};


/**
 * Maps a plain TypeScript vehicle object to the Supabase database shape
 */
function serializeCar(car: IdentifiedCar) {
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
  };
}

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
export async function fetchSupabaseGarage(): Promise<IdentifiedCar[]> {
  if (!supabase) throw new Error("Supabase is not configured.");

  const { data, error } = await supabase
    .from("vehicles")
    .select("*")
    .order("timestamp", { ascending: false });

  if (error) {
    throw error;
  }

  return (data || []).map(deserializeRow);
}

/**
 * Save or overwrite a vehicle in Supabase
 */
export async function saveSupabaseCar(car: IdentifiedCar): Promise<void> {
  if (!supabase) throw new Error("Supabase is not configured.");

  const { error } = await supabase
    .from("vehicles")
    .upsert(serializeCar(car), { onConflict: "id" });

  if (error) {
    throw error;
  }
}

/**
 * Remove a vehicle from Supabase database
 */
export async function removeSupabaseCar(id: string): Promise<void> {
  if (!supabase) throw new Error("Supabase is not configured.");

  const { error } = await supabase
    .from("vehicles")
    .delete()
    .eq("id", id);

  if (error) {
    throw error;
  }
}

/**
 * Sync multiple cars to Supabase at once (e.g. during manual cloud backup)
 */
export async function syncLocalGarageToCloud(cars: IdentifiedCar[]): Promise<{ successCount: number; errors: string[] }> {
  if (!supabase) throw new Error("Supabase is not configured.");
  if (cars.length === 0) return { successCount: 0, errors: [] };

  const errors: string[] = [];
  let successCount = 0;

  for (const car of cars) {
    try {
      await saveSupabaseCar(car);
      successCount++;
    } catch (e: any) {
      errors.push(`Failed to save ${car.make} ${car.model}: ${e.message || e}`);
    }
  }

  return { successCount, errors };
}
