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
  const cleanString = (str: string) => {
    if (!str) return "";
    let s = str.toLowerCase();
    // Remove year ranges such as 2016-2021 or 2016 - 2021
    s = s.replace(/\b(19|20)\d{2}\s*-\s*(19|20)\d{2}\b/g, "");
    // Remove single years like 2016
    s = s.replace(/\b(19|20)\d{2}\b/g, "");
    // Remove text inside parentheses e.g. (2016-2021) or (FC/FK)
    s = s.replace(/\(.*?\)/g, "");
    // Remove brackets
    s = s.replace(/\[.*?\]/g, "");
    // Strip common redundant words with word boundaries
    s = s.replace(/\b(the|all\s*new|new|generation|chassis|model|series|class|version|facelift|mk\s*\d+|na|none|n_a|n\/a|gen)\b/gi, "");
    // Keep only alphanumeric characters
    s = s.replace(/[^a-z0-9]/g, "");
    return s.trim();
  };

  const cleanBrand = cleanString(vehicle.make);
  const cleanModel = cleanString(vehicle.model);
  const cleanGen = cleanString(vehicle.generation);

  if (!cleanGen) {
    return `${cleanBrand}_${cleanModel}`;
  }
  return `${cleanBrand}_${cleanModel}_${cleanGen}`;
}
