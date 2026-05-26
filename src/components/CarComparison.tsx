import React, { useState } from "react";
import { IdentifiedCar } from "../types";
import { 
  X, Check, Zap, Gauge, DollarSign, Sparkles, Calendar, Scale, 
  ChevronDown, Flame, Award, ShieldCheck, HelpCircle, Eye, RefreshCw, Info, ThumbsUp
} from "lucide-react";

interface CarComparisonProps {
  cars: IdentifiedCar[];
  onClose: () => void;
  onRemoveFromCompare: (id: string) => void;
  activeTheme: {
    id: string;
    name: string;
    colorHex: string;
    primaryBg: string;
    cardBg: string;
    primaryText: string;
    accentText: string;
    accentBg: string;
    accentBorder: string;
    accentHover: string;
    pulseBg: string;
    glowClass: string;
  };
}

// Resilient parsing routines for numeric comparisons
function parseHorsepower(hpStr: string): number {
  if (!hpStr) return 0;
  const match = hpStr.match(/(\d+)\s*(?:hp|horsepower|ps|bhp)/i);
  if (match) return parseInt(match[1], 10);
  const fallback = hpStr.match(/\d+/);
  return fallback ? parseInt(fallback[0], 10) : 0;
}

function parseZeroToSixty(valStr: string): number {
  if (!valStr || valStr.toLowerCase().includes("n/a")) return Infinity;
  const match = valStr.match(/(\d+(?:\.\d+)?)/);
  return match ? parseFloat(match[1]) : Infinity;
}

function parsePrice(priceStr: string): number {
  if (!priceStr || priceStr.toLowerCase().includes("n/a")) return 0;
  // Strip commas, spaces, currency symbols
  const cleaned = priceStr.toLowerCase().replace(/,/g, "").replace(/egp/g, "").trim();
  const matches = cleaned.match(/\d+/g);
  if (matches && matches.length > 0) {
    if (matches.length > 1) {
      // average of range
      const v1 = parseInt(matches[0], 10);
      const v2 = parseInt(matches[1], 10);
      return (v1 + v2) / 2;
    }
    return parseInt(matches[0], 10);
  }
  return 0;
}

function parseTorque(torqueStr: string): number {
  if (!torqueStr) return 0;
  const match = torqueStr.match(/(\d+)\s*(?:nm|lb-ft|lbs-ft)/i);
  if (match) return parseInt(match[1], 10);
  const fallback = torqueStr.match(/\d+/);
  return fallback ? parseInt(fallback[0], 10) : 0;
}

function parseYear(yearStr: string): number {
  if (!yearStr) return 0;
  const match = yearStr.match(/\d{4}/);
  return match ? parseInt(match[0], 10) : 0;
}

export default function CarComparison({ cars, onClose, onRemoveFromCompare, activeTheme }: CarComparisonProps) {
  const [activeMode, setActiveMode] = useState<"summary" | "detailed">("summary");

  if (cars.length === 0) {
    return (
      <div className="p-8 text-center bg-slate-900/40 rounded-2xl border border-slate-850 space-y-4">
        <div className="w-12 h-12 rounded-full bg-slate-950 flex items-center justify-center mx-auto text-slate-500 border border-slate-800">
          <Scale className="h-6 w-6" />
        </div>
        <div>
          <h3 className="text-xs font-bold text-slate-200 uppercase font-mono">No Vehicles Selected</h3>
          <p className="text-[10px] text-slate-500 mt-1 max-w-xs mx-auto">
            Select vehicles from your Spotter Garage by pressing the compare toggle button to begin dynamic head-to-head analysis.
          </p>
        </div>
        <button
          onClick={onClose}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-xl text-xs font-bold font-mono transition"
        >
          Return to Garage
        </button>
      </div>
    );
  }

  // Calculate comparisons for 2 or more cars
  const carSpecsList = cars.map(car => ({
    car,
    hp: parseHorsepower(car.horsepower || car.power),
    accel: parseZeroToSixty(car.zeroToSixty),
    torque: parseTorque(car.torque),
    resalePrice: parsePrice(car.estimatedUsedPrice),
    newPrice: parsePrice(car.estimatedNewPrice),
    year: parseYear(car.modelYear || car.yearRange)
  }));

  // Find optimal values across comparison list (higher is better, unless acceleration or price)
  const maxHp = Math.max(...carSpecsList.map(item => item.hp), 1);
  const bestAccel = Math.min(...carSpecsList.map(item => item.accel).filter(v => v !== Infinity), 100);
  const maxTorque = Math.max(...carSpecsList.map(item => item.torque), 1);
  const minPrice = Math.min(...carSpecsList.map(item => item.resalePrice).filter(v => v > 0), Infinity);
  const maxYear = Math.max(...carSpecsList.map(item => item.year), 1);

  // Helper checking if item holds superior properties
  const isBestHp = (hp: number) => hp > 0 && hp === maxHp;
  const isBestAccel = (accel: number) => accel !== Infinity && accel === bestAccel;
  const isBestTorque = (torque: number) => torque > 0 && torque === maxTorque;
  const isBestPrice = (price: number) => price > 0 && price === minPrice; // Cheaper is best budget option
  const isBestYear = (yr: number) => yr > 0 && yr === maxYear;

  // Render a summary bullet of who won what
  const getComparisonVerb = (metric: string) => {
    if (cars.length < 2) return "";
    
    if (metric === "power") {
      const sortedByHp = [...carSpecsList].sort((a,b) => b.hp - a.hp);
      if (sortedByHp[0].hp > sortedByHp[1].hp && sortedByHp[1].hp > 0) {
        const diff = sortedByHp[0].hp - sortedByHp[1].hp;
        const pct = Math.round((diff / sortedByHp[1].hp) * 100);
        return `${sortedByHp[0].car.make} is superior with ${sortedByHp[0].hp} HP (+${diff} HP, ${pct}% more powerful than ${sortedByHp[1].car.make}).`;
      }
      return "Power outcomes are equal or unmeasurable.";
    }

    if (metric === "accel") {
      const sortedByAccel = [...carSpecsList].filter(item => item.accel !== Infinity).sort((a,b) => a.accel - b.accel);
      if (sortedByAccel.length >= 2 && sortedByAccel[0].accel < sortedByAccel[1].accel) {
        const diff = (sortedByAccel[1].accel - sortedByAccel[0].accel).toFixed(1);
        return `${sortedByAccel[0].car.make} dominates launching 0-100 km/h in ${sortedByAccel[0].car.zeroToSixty} (${diff}s faster than ${sortedByAccel[1].car.make}).`;
      }
      return "Launch speeds are equal or unmeasurable.";
    }

    if (metric === "budget") {
      const sortedByPrice = [...carSpecsList].filter(item => item.resalePrice > 0).sort((a,b) => a.resalePrice - b.resalePrice);
      if (sortedByPrice.length >= 2 && sortedByPrice[0].resalePrice < sortedByPrice[1].resalePrice) {
        const diff = sortedByPrice[1].resalePrice - sortedByPrice[0].resalePrice;
        const formattedDiff = diff >= 1000000 
          ? `${(diff / 1000000).toFixed(1)}M EGP` 
          : `${diff.toLocaleString()} EGP`;
        return `${sortedByPrice[0].car.make} represents the best value, costing ${sortedByPrice[0].car.estimatedUsedPrice} (saving ${formattedDiff} over the alternative).`;
      }
      return "Budget layouts are within comparable range.";
    }
    
    return "";
  };

  return (
    <div className="space-y-4 animate-fade-in font-sans">
      
      {/* Header Matchup Panel */}
      <div className="bg-gradient-to-br from-slate-900 via-[#0d1017] to-slate-950 p-4 rounded-2xl border border-slate-800 shadow-xl space-y-4">
        
        {/* Navigation back and quick controls */}
        <div className="flex items-center justify-between">
          <button
            onClick={onClose}
            className={`text-xs ${activeTheme.primaryText} hover:underline font-bold font-mono uppercase tracking-widest flex items-center gap-1.5 cursor-pointer`}
          >
            ← Back to Garage
          </button>
          
          <div className="flex bg-slate-950 border border-slate-800 rounded-lg p-0.5 text-[10px] font-mono">
            <button
              onClick={() => setActiveMode("summary")}
              className={`px-3 py-1 rounded-md uppercase font-bold transition-cyan transition duration-300 ${activeMode === "summary" ? `${activeTheme.accentBg} text-slate-950` : "text-slate-400 hover:text-slate-100"}`}
            >
              ⚡ Summary Mode
            </button>
            <button
              onClick={() => setActiveMode("detailed")}
              className={`px-3 py-1 rounded-md uppercase font-bold transition-cyan transition duration-300 ${activeMode === "detailed" ? `${activeTheme.accentBg} text-slate-950` : "text-slate-400 hover:text-slate-100"}`}
            >
              📋 Specs Sheet
            </button>
          </div>
        </div>

        {/* Selected Vehicles Visual Matchup Header */}
        <div className={`grid ${cars.length === 3 ? "grid-cols-3 gap-2" : "grid-cols-2 gap-3"}`}>
          {cars.map((car, idx) => (
            <div key={car.id} className="relative bg-slate-950/70 p-2.5 rounded-xl border border-slate-850 flex flex-col items-center text-center space-y-2 group">
              {/* Close pin button to remove from comparison stack */}
              <button
                onClick={() => onRemoveFromCompare(car.id)}
                className="absolute -top-1.5 -right-1.5 p-1 bg-red-950 text-red-400 border border-red-800/50 hover:bg-red-900/80 hover:text-red-100 rounded-full transition shadow-lg shrink-0 cursor-pointer"
                title="Remove from comparison list"
              >
                <X className="h-2.5 w-2.5" />
              </button>

              {/* Photo Thumbnail */}
              <div className="relative w-full h-16 sm:h-20 rounded-lg overflow-hidden border border-slate-800 bg-slate-900">
                <img
                  src={car.image}
                  alt={car.model}
                  className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-1">
                  <span className="text-[7.5px] font-mono uppercase tracking-wider text-amber-400 bg-amber-950/60 px-1 py-0.2 rounded border border-amber-500/10">
                    {idx === 0 ? "Entry A" : idx === 1 ? "Entry B" : "Entry C"}
                  </span>
                </div>
              </div>

              {/* Identity labels */}
              <div className="min-w-0 w-full">
                <h4 className="text-[10px] font-bold text-slate-100 uppercase truncate leading-snug">
                  {car.make}
                </h4>
                <p className="text-[9px] text-zinc-400 truncate tracking-tight uppercase">
                  {car.modelYear || car.model}
                </p>
                <span className="inline-block mt-1 text-[8px] font-mono font-bold bg-slate-900 text-slate-400 border border-slate-800 px-1.5 py-0.5 rounded uppercase">
                  {car.category}
                </span>
              </div>
            </div>
          ))}
          
          {cars.length < 2 && (
            <div
              onClick={onClose}
              className="bg-slate-950/20 border border-dashed border-slate-800 p-3 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:bg-slate-950/40 transition text-center space-y-1"
            >
              <div className="w-6 h-6 rounded-full border border-slate-800 flex items-center justify-center text-slate-500 text-xs font-bold">
                +
              </div>
              <span className="text-[9px] font-mono text-slate-500 uppercase font-black">Add vehicle</span>
            </div>
          )}
        </div>

        {/* Instant winner conclusion bullets */}
        {cars.length >= 2 && (
          <div className="bg-slate-950/90 p-3 rounded-xl border border-slate-850/80 space-y-1.5 text-[10.5px]">
            <span className="text-[8px] font-bold font-mono uppercase text-slate-500 tracking-wider block">⚡ Quick Matchup Verdict:</span>
            <div className="space-y-1 text-slate-300 leading-normal font-sans">
              <div className="flex items-center gap-1.5 text-[10px]">
                <Flame className="h-3 w-3 text-red-400 shrink-0" />
                <p>{getComparisonVerb("power")}</p>
              </div>
              <div className="flex items-center gap-1.5 text-[10px]">
                <Gauge className="h-3 w-3 text-purple-400 shrink-0" />
                <p>{getComparisonVerb("accel")}</p>
              </div>
              <div className="flex items-center gap-1.5 text-[10px]">
                <DollarSign className="h-3 w-3 text-emerald-400 shrink-0" />
                <p>{getComparisonVerb("budget")}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* SUMMARY HEAD-TO-HEAD MODE */}
      {activeMode === "summary" && (
        <div className="space-y-4">
          
          {/* HORSEPOWER CARD COMPARATOR */}
          <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-850 space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Flame className="h-4 w-4 text-red-400" />
                <span className="text-xs font-black uppercase text-slate-200 font-display">Power / Horsepower MATCH</span>
              </div>
              <span className="text-[9px] font-mono text-slate-500">HI-HP IS BETTER</span>
            </div>

            <div className="space-y-3">
              {carSpecsList.map(({ car, hp }) => {
                const ratio = maxHp ? (hp / maxHp) * 100 : 0;
                const winner = isBestHp(hp);
                return (
                  <div key={car.id} className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-sans">
                      <span className="font-bold text-slate-300 line-clamp-1 max-w-[65%] uppercase">
                        {car.make} {car.model}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0 font-mono">
                        <span className={`font-semibold ${winner ? "text-red-400 font-black" : "text-slate-400"}`}>
                          {hp > 0 ? `${hp} HP` : "N/A"}
                        </span>
                        {winner && (
                          <span className="bg-red-500/10 text-red-400 border border-red-500/25 text-[8px] font-bold px-1 py-0.2 rounded font-mono uppercase">
                            🏆 PEAK
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Visual progress bar */}
                    <div className="h-2 bg-slate-950 rounded-full overflow-hidden flex">
                      <div 
                        style={{ width: `${ratio}%` }}
                        className={`transition-all duration-500 rounded-full ${
                          winner 
                            ? "bg-gradient-to-r from-red-600 to-amber-500 shadow-[0_0_6px_rgba(239,68,68,0.3)] animate-pulse" 
                            : "bg-slate-700"
                        }`}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ACCELERATION CARD COMPARATOR */}
          <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-850 space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Gauge className="h-4 w-4 text-purple-400" />
                <span className="text-xs font-black uppercase text-slate-200 font-display">0-100 KM/H SPEED Match</span>
              </div>
              <span className="text-[9px] font-mono text-slate-500">LOWER IS BETTER</span>
            </div>

            <div className="space-y-3">
              {carSpecsList.map(({ car, accel }) => {
                // If accel is infinity, ratio is 0
                const slowestAccel = Math.max(...carSpecsList.map(item => item.accel).filter(v => v !== Infinity), 15);
                const ratio = accel !== Infinity && slowestAccel ? (1 - (accel - bestAccel) / (slowestAccel - bestAccel || 1)) * 60 + 40 : 0;
                const winner = isBestAccel(accel);
                return (
                  <div key={car.id} className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-sans">
                      <span className="font-bold text-slate-300 line-clamp-1 max-w-[65%] uppercase">
                        {car.make} {car.model}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0 font-mono">
                        <span className={`font-semibold ${winner ? "text-purple-400 font-black" : "text-slate-400"}`}>
                          {accel !== Infinity ? `${accel}s` : "N/A"}
                        </span>
                        {winner && (
                          <span className="bg-purple-500/10 text-purple-400 border border-purple-500/25 text-[8px] font-bold px-1 py-0.2 rounded font-mono uppercase">
                            ⚡ FASTEST
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Visual progress bar */}
                    <div className="h-2 bg-slate-950 rounded-full overflow-hidden flex">
                      <div 
                        style={{ width: `${accel === Infinity ? 0 : ratio}%` }}
                        className={`transition-all duration-500 rounded-full ${
                          winner 
                            ? "bg-gradient-to-r from-purple-500 to-pink-500 shadow-[0_0_6px_rgba(168,85,247,0.3)]" 
                            : "bg-slate-700"
                        }`}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* BUDGET PRICE CARD COMPARATOR */}
          <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-850 space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <DollarSign className="h-4 w-4 text-emerald-400" />
                <span className="text-xs font-black uppercase text-slate-200 font-display">Est. Resale Affordability</span>
              </div>
              <span className="text-[9px] font-mono text-slate-500">LOWER IS CHEAPER</span>
            </div>

            <div className="space-y-3">
              {carSpecsList.map(({ car, resalePrice }) => {
                const highestPrice = Math.max(...carSpecsList.map(item => item.resalePrice).filter(v => v > 0), 10000);
                const ratio = resalePrice > 0 && highestPrice ? (resalePrice / highestPrice) * 100 : 0;
                const isCheapest = isBestPrice(resalePrice);
                return (
                  <div key={car.id} className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-sans">
                      <span className="font-bold text-slate-300 line-clamp-1 max-w-[65%] uppercase">
                        {car.make} {car.model}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0 font-mono">
                        <span className={`font-semibold ${isCheapest ? "text-emerald-400 font-black" : "text-slate-400"}`}>
                          {resalePrice > 0 ? car.estimatedUsedPrice : "N/A"}
                        </span>
                        {isCheapest && carSpecsList.length > 1 && (
                          <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 text-[8px] font-bold px-1 py-0.2 rounded font-mono uppercase">
                            💎 VALUE
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Visual progress bar */}
                    <div className="h-2 bg-slate-950 rounded-full overflow-hidden flex">
                      <div 
                        style={{ width: `${ratio}%` }}
                        className={`transition-all duration-500 rounded-full ${
                          isCheapest 
                            ? "bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_6px_rgba(16,185,129,0.3)]" 
                            : "bg-slate-700"
                        }`}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* MECHANICAL TORQUE CAR COMPARATOR */}
          <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-850 space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <RefreshCw className="h-4 w-4 text-orange-400" />
                <span className="text-xs font-black uppercase text-slate-200 font-display">Engine Mechanical Torque</span>
              </div>
              <span className="text-[9px] font-mono text-slate-500">HIGHER Nm IS BETTER</span>
            </div>

            <div className="space-y-3">
              {carSpecsList.map(({ car, torque }) => {
                const ratio = maxTorque ? (torque / maxTorque) * 100 : 0;
                const winner = isBestTorque(torque);
                return (
                  <div key={car.id} className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-sans">
                      <span className="font-bold text-slate-300 line-clamp-1 max-w-[65%] uppercase">
                        {car.make} {car.model}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0 font-mono">
                        <span className={`font-semibold ${winner ? "text-orange-400 font-black" : "text-slate-400"}`}>
                          {torque > 0 ? `${torque} Nm` : "N/A"}
                        </span>
                        {winner && (
                          <span className="bg-orange-500/10 text-orange-400 border border-orange-500/25 text-[8px] font-bold px-1 py-0.2 rounded font-mono uppercase">
                            ⚙️ PULL
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Visual progress bar */}
                    <div className="h-2 bg-slate-950 rounded-full overflow-hidden flex">
                      <div 
                        style={{ width: `${ratio}%` }}
                        className={`transition-all duration-500 rounded-full ${
                          winner 
                            ? "bg-gradient-to-r from-orange-500 to-yellow-500 shadow-[0_0_6px_rgba(249,115,22,0.3)]" 
                            : "bg-slate-700"
                        }`}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      )}

      {/* FULL UNIFIED DETAILS SPECS MODE */}
      {activeMode === "detailed" && (
        <div className="bg-slate-900/50 rounded-xl border border-slate-850 overflow-hidden">
          
          <div className="p-3 border-b border-slate-850 bg-slate-950">
            <h3 className="text-[10px] font-mono tracking-widest text-amber-500 uppercase font-bold">Comprehensive Mechanical Database</h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300 font-sans border-collapse">
              <thead>
                <tr className="border-b border-slate-850 text-[10px] font-mono uppercase text-slate-500 bg-slate-950/40">
                  <th className="p-3">Specification Item</th>
                  {cars.map((car, i) => (
                    <th key={car.id} className="p-3 uppercase">
                      {idxToLetter(i)}: {car.make}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Years row */}
                <tr className="border-b border-slate-850/60 hover:bg-slate-950/20">
                  <td className="p-3 font-medium text-slate-400 font-mono text-[11px]">Model Year / Span</td>
                  {carSpecsList.map(({ car, year }) => {
                    const best = isBestYear(year);
                    return (
                      <td key={car.id} className={`p-3 font-mono ${best && cars.length > 1 ? "text-emerald-400 font-bold" : "text-slate-200"}`}>
                        {car.modelYear || car.yearRange}
                        {best && cars.length > 1 && " (Newest)"}
                      </td>
                    );
                  })}
                </tr>

                {/* Category row */}
                <tr className="border-b border-slate-850/60 hover:bg-slate-950/20">
                  <td className="p-3 font-medium text-slate-400 font-mono text-[11px]">Category Class</td>
                  {cars.map(car => (
                    <td key={car.id} className="p-3 text-slate-200">
                      {car.category || "N/A"}
                    </td>
                  ))}
                </tr>

                {/* Powertrain Engine Type */}
                <tr className="border-b border-slate-850/60 hover:bg-slate-950/20">
                  <td className="p-3 font-medium text-slate-400 font-mono text-[11px]">Powertrain Type</td>
                  {cars.map(car => (
                    <td key={car.id} className="p-3 text-slate-200 leading-relaxed text-[11px]">
                      {car.engineType || "N/A"}
                    </td>
                  ))}
                </tr>

                {/* Horsepower Row */}
                <tr className="border-b border-slate-850/60 hover:bg-slate-950/20">
                  <td className="p-3 font-medium text-slate-400 font-mono text-[11px]">Horsepower</td>
                  {carSpecsList.map(({ car, hp }) => {
                    const best = isBestHp(hp);
                    return (
                      <td key={car.id} className={`p-3 ${best && cars.length > 1 ? "text-red-400 font-bold" : "text-slate-200"}`}>
                        {car.horsepower || car.power || "N/A"}
                        {best && cars.length > 1 && " (🏆 Peak)"}
                      </td>
                    );
                  })}
                </tr>

                {/* Torque Row */}
                <tr className="border-b border-slate-850/60 hover:bg-slate-950/20">
                  <td className="p-3 font-medium text-slate-400 font-mono text-[11px]">Mechanical Torque</td>
                  {carSpecsList.map(({ car, torque }) => {
                    const best = isBestTorque(torque);
                    return (
                      <td key={car.id} className={`p-3 ${best && cars.length > 1 ? "text-orange-400 font-bold" : "text-slate-200"}`}>
                        {car.torque || "N/A"}
                        {best && cars.length > 1 && " (⚙️ Best)"}
                      </td>
                    );
                  })}
                </tr>

                {/* Integration 0-100 */}
                <tr className="border-b border-slate-850/60 hover:bg-slate-950/20">
                  <td className="p-3 font-medium text-slate-400 font-mono text-[11px]">0-100 km/h Launch</td>
                  {carSpecsList.map(({ car, accel }) => {
                    const best = isBestAccel(accel);
                    return (
                      <td key={car.id} className={`p-3 font-mono ${best && cars.length > 1 ? "text-purple-400 font-bold" : "text-slate-200"}`}>
                        {car.zeroToSixty || "N/A"}
                        {best && cars.length > 1 && " (⚡ Fastest)"}
                      </td>
                    );
                  })}
                </tr>

                {/* Transmission */}
                <tr className="border-b border-slate-850/60 hover:bg-slate-950/20">
                  <td className="p-3 font-medium text-slate-400 font-mono text-[11px]">Transmission Type</td>
                  {cars.map(car => (
                    <td key={car.id} className="p-3 text-slate-200">
                      {car.specs?.transmission || "N/A"}
                    </td>
                  ))}
                </tr>

                {/* Drivetrain layout */}
                <tr className="border-b border-slate-850/60 hover:bg-slate-950/20">
                  <td className="p-3 font-medium text-slate-400 font-mono text-[11px]">Drivetrain Layout</td>
                  {cars.map(car => (
                    <td key={car.id} className="p-3 text-slate-200 uppercase font-mono">
                      {car.specs?.driveType || "N/A"}
                    </td>
                  ))}
                </tr>

                {/* Fuel Economy */}
                <tr className="border-b border-slate-850/60 hover:bg-slate-950/20">
                  <td className="p-3 font-medium text-slate-400 font-mono text-[11px]">Fuel Economy / Range</td>
                  {cars.map(car => (
                    <td key={car.id} className="p-3 text-emerald-400">
                      {car.specs?.fuelEconomy || "N/A"}
                    </td>
                  ))}
                </tr>

                {/* Est. Brand New */}
                <tr className="border-b border-slate-850/60 hover:bg-slate-950/20">
                  <td className="p-3 font-medium text-slate-400 font-mono text-[11px]">Est. New price</td>
                  {cars.map(car => (
                    <td key={car.id} className="p-3 text-slate-200">
                      {car.estimatedNewPrice || "N/A"}
                    </td>
                  ))}
                </tr>

                {/* Est. Used resale level */}
                <tr className="border-b border-slate-850/60 hover:bg-slate-950/20">
                  <td className="p-3 font-medium text-slate-400 font-mono text-[11px]">Est. Used resale</td>
                  {carSpecsList.map(({ car, resalePrice }) => {
                    const best = isBestPrice(resalePrice);
                    return (
                      <td key={car.id} className={`p-3 font-mono ${best && cars.length > 1 ? "text-emerald-400 font-bold" : "text-slate-200"}`}>
                        {car.estimatedUsedPrice || "N/A"}
                        {best && cars.length > 1 && " (💎 Wallet Friendly)"}
                      </td>
                    );
                  })}
                </tr>

                {/* Vision Match confidence */}
                <tr className="border-b border-slate-850/60 hover:bg-slate-950/20">
                  <td className="p-3 font-medium text-slate-400 font-mono text-[11px]">AI Confidence level</td>
                  {cars.map(car => (
                    <td key={car.id} className="p-3 font-mono text-slate-200">
                      {Math.round((car.confidence || 0.9) * 100)}% Match
                    </td>
                  ))}
                </tr>

                {/* Primary Paint color */}
                <tr className="border-b border-[#1f2937]/30 hover:bg-[#111827]/10">
                  <td className="p-3 font-medium text-slate-400 font-mono text-[11px]">Scanned Paint Color</td>
                  {cars.map(car => (
                    <td key={car.id} className="p-3 text-slate-200 capitalize">
                      {car.color || "N/A"}
                    </td>
                  ))}
                </tr>

                {/* Trivia Counts */}
                <tr className="hover:bg-slate-950/10">
                  <td className="p-3 font-medium text-slate-400 font-mono text-[11px]">Historical trivia segments</td>
                  {cars.map(car => (
                    <td key={car.id} className="p-3 text-slate-200">
                      {car.trivia?.length || 0} items
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Action panel */}
      <div className="flex justify-end gap-3 pt-2">
        <button
          onClick={onClose}
          className={`${activeTheme.accentBg} ${activeTheme.accentHover} text-slate-950 font-bold font-mono text-xs px-5 py-2.5 rounded-xl transition cursor-pointer`}
        >
          Close Matchup
        </button>
      </div>

    </div>
  );
}

function idxToLetter(i: number): string {
  if (i === 0) return "A";
  if (i === 1) return "B";
  return "C";
}
