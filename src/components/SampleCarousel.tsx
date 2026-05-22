import { Sparkles } from "lucide-react";

interface SampleCar {
  name: string;
  category: string;
  imageUrl: string;
  hint: string;
}

const SAMPLE_CARS: SampleCar[] = [
  {
    name: "Porsche 911 Carrera",
    category: "Sports Car / Coupe",
    imageUrl: "https://images.unsplash.com/photo-1614162692292-7ac56d7f7f1e?auto=format&fit=crop&q=80&w=800",
    hint: "Identify iconic rear profile and distinct curves."
  },
  {
    name: "Tesla Model Y",
    category: "Electric Crossover",
    imageUrl: "https://images.unsplash.com/photo-1619767886558-efdc259cde1a?auto=format&fit=crop&q=80&w=800",
    hint: "Identify sleek aerodynamics and minimalist EV styling."
  },
  {
    name: "Ford Mustang GT",
    category: "Muscle Car",
    imageUrl: "https://images.unsplash.com/photo-1584345604476-8ec5e7ea8f49?auto=format&fit=crop&q=80&w=800",
    hint: "Identify classic fastback lines and aggressive grille."
  },
  {
    name: "Jeep Wrangler Rubicon",
    category: "Rugged 4x4 Off-road",
    imageUrl: "https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&q=80&w=800",
    hint: "Identify distinct round headlights, fender flares, and vertical grille."
  }
];

interface SampleCarouselProps {
  onSelectSample: (url: string) => void;
  disabled: boolean;
}

export default function SampleCarousel({ onSelectSample, disabled }: SampleCarouselProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5 px-1">
        <Sparkles className="h-4 w-4 text-emerald-400 animate-pulse" />
        <h3 className="text-sm font-semibold text-slate-200 font-display">Test with High-Res Active Samples</h3>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {SAMPLE_CARS.map((car, idx) => (
          <button
            key={idx}
            disabled={disabled}
            onClick={() => onSelectSample(car.imageUrl)}
            className="group relative flex flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/40 hover:bg-slate-900/90 text-left transition-all duration-300 hover:border-emerald-500/50 hover:scale-[1.02] focus:outline-none disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
          >
            <div className="relative h-28 w-full overflow-hidden">
              <img
                src={car.imageUrl}
                alt={car.name}
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent"></div>
              <div className="absolute top-2 right-2 rounded-md bg-slate-900/80 backdrop-blur-md px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-emerald-400 border border-emerald-500/30">
                Sample
              </div>
            </div>
            <div className="p-3 space-y-0.5">
              <span className="block text-[10px] font-mono tracking-wider text-slate-500 uppercase">{car.category}</span>
              <h4 className="text-xs font-semibold text-slate-150 font-display line-clamp-1 group-hover:text-emerald-400 transition-colors uppercase">{car.name}</h4>
              <p className="text-[10px] text-slate-400 leading-snug line-clamp-1 italic">{car.hint}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
