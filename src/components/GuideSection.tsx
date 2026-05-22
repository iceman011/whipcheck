import { Compass, Camera, Sparkles, CheckCircle, Flame, ShieldAlert } from "lucide-react";

export default function GuideSection() {
  const guidelines = [
    {
      title: "Three-Quarter Front Angle",
      description: "Walk to the front-corner (45° angle) of the car. This captures both the front fascia, headlights, grille, and the side body profile simultaneously, providing the AI with the maximum structural cues.",
      rating: "Best Results",
      ratingColor: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
    },
    {
      title: "Focus on Details & Badges",
      description: "If identifying a clean custom trim or rare edition, get a high-contrast shot of the trunk emblem, rear taillight signature, or custom wheel center caps. Our computer vision model looks for fine visual contours.",
      rating: "Very High Accuracy",
      ratingColor: "bg-teal-500/10 text-teal-400 border-teal-500/20"
    },
    {
      title: "Avoid Heavy Shadows",
      description: "Direct sunlight can wash out paint tones, while heavy overhead bridge shade blinds grille shapes. Capture photos with consistent diffuse ambient lighting -- sunrise, sunset, or cloudy skies are ideal.",
      rating: "Recommended",
      ratingColor: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20"
    },
    {
      title: "Clean Headlamps & Refraction",
      description: "Ensure the camera lens is wiped clean of smudges, and try to minimize direct headlight glare or high reflective sunspots bouncing off the passenger doors.",
      rating: "Tips",
      ratingColor: "bg-slate-500/10 text-slate-400 border-slate-500/20"
    }
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Introduction Hero Card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 p-5 border border-slate-800">
        <div className="absolute top-0 right-0 h-32 w-32 bg-emerald-500/5 rounded-full blur-2xl"></div>
        <div className="flex gap-4 items-start relative z-10">
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20 shrink-0">
            <Compass className="h-6 w-6" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-base font-bold text-slate-100 font-display">Car Spotting Vision Guide</h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Our advanced deep learning computer vision system is fine-tuned to extract design signatures, body trims, wheel profiles, and manufacturer branding. Follow these spotting strategies to achieve premium confidence ratings.
            </p>
          </div>
        </div>
      </div>

      {/* Grid of Rules */}
      <div className="space-y-3">
        <h3 className="text-xs font-mono tracking-widest text-slate-400 uppercase px-1">Best Practices</h3>
        <div className="grid gap-3">
          {guidelines.map((guide, idx) => (
            <div key={idx} className="bg-slate-900/40 p-4 rounded-xl border border-slate-850 hover:border-slate-800 transition-colors space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-xs font-bold text-slate-200 font-display uppercase">{guide.title}</span>
                <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full border uppercase tracking-wider font-mono ${guide.ratingColor}`}>
                  {guide.rating}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">{guide.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Pro Spotting Advice */}
      <div className="bg-amber-500/5 rounded-xl border border-amber-500/10 p-4 flex gap-3 items-start">
        <ShieldAlert className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h4 className="text-xs font-bold text-amber-400 font-display uppercase">Spotter Alert: Clean Framing</h4>
          <p className="text-[10px] text-slate-400 leading-relaxed">
            Ensure the vehicle occupies at least 60% of the camera grid box. Blurry background noise, crowded public parking spaces, or excessive distance can slightly decay detection resolution. Use your phone's zoom if required!
          </p>
        </div>
      </div>
    </div>
  );
}
