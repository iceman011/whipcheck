import { IdentifiedCar } from "../types";
import { 
  Sparkles, CheckCircle2, AlertTriangle, PlayCircle, ShieldAlert,
  Gauge, Fuel, DollarSign, Settings2, Trash2, Calendar, Palette, Info, HelpCircle
} from "lucide-react";

interface CarDetailsReportProps {
  car: IdentifiedCar;
  onSave?: () => void;
  onDiscard: () => void;
  isSaved?: boolean;
}

export default function CarDetailsReport({ car, onSave, onDiscard, isSaved = false }: CarDetailsReportProps) {
  // If the image is analyzed and determined not to be a car
  if (!car.isCar) {
    return (
      <div className="bg-slate-900/60 rounded-2xl border border-red-500/30 p-6 space-y-4 max-w-lg mx-auto text-center animate-fade-in">
        <div className="mx-auto w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20 text-red-400">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-base font-bold text-slate-100 font-display uppercase">Vehicle Not Identified</h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            Our computer vision model analyzed the image but could not reliably spot a car, SUV, motorcycle, or light truck. Please ensure the vehicle is clear, well-framed, and occupies most of the photograph.
          </p>
        </div>
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 text-left text-[11px] text-slate-400 space-y-1">
          <span className="font-mono text-red-400 font-semibold uppercase block tracking-wider">AI Vision Log:</span>
          <p>Confidence score was too low or the object classes detected fell outside automotive parameters. Avoid scanning close-up interior fabric, isolated car tires, dashboard buttons, other household items, or generic paperwork.</p>
        </div>
        <div className="pt-2">
          <button
            onClick={onDiscard}
            className="w-full bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-semibold font-display py-2.5 rounded-xl border border-slate-700 transition"
          >
            Try Scanning Again
          </button>
        </div>
      </div>
    );
  }

  // Calculate dynamic colors based on confidence
  const confPercent = Math.round(car.confidence * 100);
  const isHighConf = car.confidence >= 0.8;
  const isMedConf = car.confidence >= 0.5 && car.confidence < 0.8;

  const confColor = isHighConf 
    ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" 
    : isMedConf 
    ? "text-amber-400 bg-amber-500/10 border-amber-500/20" 
    : "text-rose-400 bg-rose-500/10 border-rose-500/20";

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Immersive Photo Header */}
      <div className="relative h-56 rounded-2xl overflow-hidden border border-slate-800 bg-slate-950">
        <img
          src={car.image}
          alt={`${car.make} ${car.model}`}
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent"></div>
        
        {/* Confidence Badge */}
        <div className="absolute top-3 right-3">
          <div className={`flex items-center gap-1.5 backdrop-blur-md px-3 py-1 rounded-full border text-[10px] font-mono tracking-wider uppercase font-semibold ${confColor}`}>
            <CheckCircle2 className="h-3 w-3 shrink-0" />
            <span>{confPercent}% Match</span>
          </div>
        </div>

        {/* Floating Identity Summary */}
        <div className="absolute bottom-4 left-4 right-4">
          <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-400 bg-emerald-900/30 px-2 py-0.5 rounded border border-emerald-500/20 inline-block mb-1.5">
            {car.category}
          </span>
          <h1 className="text-xl font-bold font-display text-white tracking-tight uppercase leading-tight line-clamp-1">
            {car.make} {car.model}
          </h1>
          <p className="text-xs text-slate-350 font-mono mt-0.5">
            {car.generation !== "N/A" && `${car.generation} • `}Estimated: {car.yearRange}
          </p>
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* Powertrain */}
        <div className="bg-slate-900/40 p-3 rounded-xl border border-slate-850 space-y-1">
          <div className="flex items-center gap-1.5 text-slate-400 text-[10px] font-mono uppercase">
            <Settings2 className="h-3.5 w-3.5 text-slate-500" />
            <span>Powertrain</span>
          </div>
          <p className="text-xs font-semibold text-slate-200 line-clamp-2 leading-relaxed">{car.engineType}</p>
        </div>

        {/* Acceleration */}
        <div className="bg-slate-900/40 p-3 rounded-xl border border-slate-850 space-y-1">
          <div className="flex items-center gap-1.5 text-slate-400 text-[10px] font-mono uppercase">
            <Gauge className="h-3.5 w-3.5 text-slate-500" />
            <span>0-60 MPH</span>
          </div>
          <p className="text-xs font-semibold text-slate-200">{car.zeroToSixty}</p>
        </div>

        {/* Brand New Value */}
        <div className="bg-slate-900/40 p-3 rounded-xl border border-slate-850 space-y-1">
          <div className="flex items-center gap-1.5 text-slate-400 text-[10px] font-mono uppercase">
            <DollarSign className="h-3.5 w-3.5 text-emerald-500" />
            <span>New MSRP</span>
          </div>
          <p className="text-xs font-semibold text-slate-200">{car.estimatedNewPrice}</p>
        </div>

        {/* Market Value Used */}
        <div className="bg-slate-900/40 p-3 rounded-xl border border-slate-850 space-y-1">
          <div className="flex items-center gap-1.5 text-slate-400 text-[10px] font-mono uppercase">
            <DollarSign className="h-3.5 w-3.5 text-indigo-400" />
            <span>Resale Range</span>
          </div>
          <p className="text-xs font-semibold text-teal-400 font-mono">{car.estimatedUsedPrice}</p>
        </div>
      </div>

      {/* Engineering Specs Block */}
      <div className="bg-slate-900/20 p-4 rounded-xl border border-slate-850 space-y-3">
        <h3 className="text-[10px] font-mono tracking-widest text-slate-500 uppercase">Mechanical Specifications</h3>
        
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-slate-900/50 p-2 rounded-lg border border-slate-850/60">
            <span className="block text-[8px] font-mono text-slate-500 uppercase tracking-wider">Transmission</span>
            <span className="text-[10px] font-semibold text-slate-300 block mt-1 line-clamp-1">{car.specs.transmission}</span>
          </div>
          <div className="bg-slate-900/50 p-2 rounded-lg border border-slate-850/60">
            <span className="block text-[8px] font-mono text-slate-500 uppercase tracking-wider">Drivetrain</span>
            <span className="text-[10px] font-semibold text-slate-300 block mt-1 uppercase font-mono">{car.specs.driveType}</span>
          </div>
          <div className="bg-slate-900/50 p-2 rounded-lg border border-slate-850/60">
            <span className="block text-[8px] font-mono text-slate-500 uppercase tracking-wider">Fuel / range</span>
            <span className="text-[10px] font-semibold text-slate-300 block mt-1 line-clamp-1">{car.specs.fuelEconomy}</span>
          </div>
        </div>

        <div className="flex items-center justify-between pt-1.5 border-t border-slate-850/40 text-[10px]">
          <span className="text-slate-400 font-mono flex items-center gap-1">
            <Palette className="h-3 w-3 text-slate-500" /> Detected Paint Color:
          </span>
          <span className="text-slate-250 font-bold capitalize">{car.color}</span>
        </div>
      </div>

      {/* Historical Facts / Trivia */}
      <div className="space-y-2">
        <div className="flex items-center gap-1 px-1">
          <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
          <h3 className="text-xs font-bold text-slate-200 font-display uppercase tracking-wider">Historical Trivia</h3>
        </div>
        <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-850 space-y-3">
          {car.trivia.map((t, index) => (
            <div key={index} className="flex gap-2.5 items-start">
              <span className="text-xs text-emerald-400 font-mono font-bold mt-0.5">0{index+1}.</span>
              <p className="text-[11px] text-slate-400 leading-relaxed">{t}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Owner / Buyer Spotlight Tips */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 px-1">
          <Info className="h-3.5 w-3.5 text-teal-400" />
          <h3 className="text-xs font-bold text-slate-200 font-display uppercase tracking-wider">Collector & Buyer Spotlights</h3>
        </div>
        <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-850 space-y-3">
          {car.tips.map((tip, idx) => (
            <div key={idx} className="flex gap-2.5 items-start">
              <div className="w-1.5 h-1.5 rounded-full bg-teal-400 mt-1.5 shrink-0"></div>
              <p className="text-[11px] text-slate-400 leading-relaxed">{tip}</p>
            </div>
          ))}
        </div>
      </div>

      {/* App Actions Frame */}
      <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-850">
        <button
          onClick={onDiscard}
          className="bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 text-xs font-semibold py-2.5 rounded-xl transition cursor-pointer text-center"
        >
          Scan Another Car
        </button>

        {onSave && (
          <button
            onClick={onSave}
            disabled={isSaved}
            className={`text-xs font-semibold py-2.5 rounded-xl transition cursor-pointer text-center border ${
              isSaved 
                ? "bg-emerald-900/20 text-emerald-400 border-emerald-500/20 pointer-events-none" 
                : "bg-emerald-500 hover:bg-emerald-600 text-slate-950 border-emerald-400 font-bold"
            }`}
          >
            {isSaved ? "Saved to Garage" : "Add to Garage"}
          </button>
        )}
      </div>
    </div>
  );
}
