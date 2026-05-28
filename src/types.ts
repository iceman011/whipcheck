export interface CarSpecs {
  transmission: string;
  driveType: string;
  fuelEconomy: string;
}

export interface IdentifiedCar {
  id: string;
  timestamp: string;
  image: string; // base64 or URL
  isCar: boolean;
  make: string;
  model: string;
  generation: string;
  yearRange: string;
  confidence: number;
  color: string;
  category: string;
  engineType: string;
  power: string;
  horsepower: string;
  torque: string;
  modelYear: string;
  zeroToSixty: string;
  estimatedNewPrice: string;
  estimatedUsedPrice: string;
  trivia: string[];
  tips: string[];
  specs: CarSpecs;
}

export type ScanStepType = 'idle' | 'capture' | 'uploading' | 'enhancing' | 'parsing_vision' | 'done' | 'error';

export function getNormalizedCarKey(vehicle: IdentifiedCar): string {
  const brand = (vehicle.make || "").trim().toLowerCase();
  const modelName = (vehicle.model || "").trim().toLowerCase();
  const gen = (vehicle.generation || "").trim().toLowerCase();
  return `${brand}_${modelName}_${gen}`.replace(/[^a-z0-9]/g, "_");
}
