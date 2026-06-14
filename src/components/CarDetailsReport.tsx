import React, { useState, useEffect } from "react";
import { IdentifiedCar, getNormalizedCarKey } from "../types";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { 
  Sparkles, CheckCircle2, AlertTriangle, PlayCircle, ShieldAlert,
  Gauge, Fuel, DollarSign, Settings2, Trash2, Calendar, Palette, Info, HelpCircle,
  MessageSquare, Share2, Send, Copy, Check, Users
} from "lucide-react";

interface CarDetailsReportProps {
  car: IdentifiedCar;
  onSave?: () => void;
  onDiscard: () => void;
  isSaved?: boolean;
  saveError?: string | null;
  selectedPlanTier?: 'chiptuning' | 'teen_passion' | 'gasoline_gold';
  onOpenPlans?: (tier?: 'chiptuning' | 'teen_passion' | 'gasoline_gold') => void;
}

function getVisualColorHex(colorName: string): string {
  const c = (colorName || "").toLowerCase();
  if (c.includes("white")) return "#ffffff";
  if (c.includes("black")) return "#111115";
  if (c.includes("gray") || c.includes("grey") || c.includes("silver") || c.includes("slate") || c.includes("metallic")) return "#8e9bb0";
  if (c.includes("blue") || c.includes("cyan")) return "#1d4ed8";
  if (c.includes("red") || c.includes("burgundy") || c.includes("crimson")) return "#dc2626";
  if (c.includes("yellow") || c.includes("gold")) return "#eab308";
  if (c.includes("green")) return "#15803d";
  if (c.includes("orange")) return "#ea580c";
  if (c.includes("brown") || c.includes("bronze") || c.includes("beige")) return "#854d0e";
  return "#3b82f6"; // comfortable blue fallback
}

// Helper to render stars
const renderStars = (count: number) => {
  const rounded = Math.round(count);
  return (
    <div className="flex items-center gap-0.5" title={`${count.toFixed(1)} / 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <span key={star} className={`text-[10px] ${star <= rounded ? "text-amber-400 font-extrabold" : "text-zinc-700 font-medium"}`}>
          ★
        </span>
      ))}
    </div>
  );
};

const StarRatingInput = ({ 
  label, 
  value, 
  onChange 
}: { 
  label: string, 
  value: number, 
  onChange: (val: number) => void 
}) => {
  return (
    <div className="flex items-center justify-between text-xs py-1">
      <span className="text-zinc-400 font-mono text-[9px] uppercase tracking-wider">{label}</span>
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star === value ? 0 : star)}
            className={`text-sm transition-all px-0.5 py-0 cursor-pointer hover:scale-125 focus:outline-none ${
              star <= value ? 'text-amber-400 font-extrabold' : 'text-zinc-600 hover:text-amber-300'
            }`}
          >
            ★
          </button>
        ))}
        {value > 0 && <span className="text-[10px] text-zinc-500 font-mono ml-1 font-bold">({value}/5)</span>}
      </div>
    </div>
  );
};

export default function CarDetailsReport({ 
  car, 
  onSave, 
  onDiscard, 
  isSaved = false, 
  saveError = null,
  selectedPlanTier = 'chiptuning',
  onOpenPlans
}: CarDetailsReportProps) {
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

  const carCommentKey = getNormalizedCarKey(car);

  interface ReportComment {
    id: string;
    author: string;
    text: string;
    timestamp: string;
    comfort?: number;
    gasConsumption?: number;
    performance?: number;
    reliability?: number;
  }

  // Comments state with live backend synchronization
  const [comments, setComments] = useState<ReportComment[]>([]);
  const [ratingComfort, setRatingComfort] = useState<number>(0);
  const [ratingGas, setRatingGas] = useState<number>(0);
  const [ratingPerf, setRatingPerf] = useState<number>(0);
  const [ratingReliability, setRatingReliability] = useState<number>(0);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [subscriptionWarning, setSubscriptionWarning] = useState<string | null>(null);
  
  const [broadcastCountUsed, setBroadcastCountUsed] = useState<number>(() => {
    return parseInt(localStorage.getItem("whipcheck_broadcasts_use_count") || "0", 10);
  });

  const checkAndRegisterBroadcast = (): boolean => {
    if (selectedPlanTier === 'chiptuning') {
      setSubscriptionWarning("🔒 Spotter Card Broadcasting holds limited permissions. Upgrade to Teen Passion to activate custom share links!");
      setTimeout(() => setSubscriptionWarning(null), 5000);
      onOpenPlans?.('teen_passion');
      return false;
    }
    if (selectedPlanTier === 'teen_passion') {
      if (broadcastCountUsed >= 3) {
        setSubscriptionWarning("🔒 You have used your 3 Teen Passion broadcasts limit. Upgrade to Gasoline Gold for unlimited broadcasts!");
        setTimeout(() => setSubscriptionWarning(null), 5000);
        onOpenPlans?.('gasoline_gold');
        return false;
      }
      const nextCount = broadcastCountUsed + 1;
      setBroadcastCountUsed(nextCount);
      localStorage.setItem("whipcheck_broadcasts_use_count", nextCount.toString());
    }
    return true;
  };

  const [newCommentText, setNewCommentText] = useState("");
  const [spotterUserName, setSpotterUserName] = useState(() => {
    try {
      const savedUser = localStorage.getItem("whipcheck_user_session");
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        if (parsed) {
          const name = parsed.username || parsed.email || parsed.id;
          if (name) return name;
        }
      }
    } catch (e) {
      console.error(e);
    }
    return localStorage.getItem("whipcheck_spotter_name") || "Guest";
  });

  const [showSharePanel, setShowSharePanel] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedText, setCopiedText] = useState(false);

  // Load comments from Supabase (or fallback)
  const fetchComments = async () => {
    setIsLoadingComments(true);
    try {
      if (isSupabaseConfigured() && supabase) {
        const { data, error } = await supabase
          .from("comments")
          .select("*")
          .eq("car_id", carCommentKey)
          .order("created_at", { ascending: true });

        if (error) {
          console.warn("Supabase comments error, falling back locally", error);
          throw error;
        }

        const mappedComments = (data || []).map(row => ({
          id: row.id,
          author: row.author,
          text: row.text,
          timestamp: row.timestamp || new Date(row.created_at).toLocaleDateString(),
          comfort: typeof row.comfort === 'number' ? row.comfort : undefined,
          gasConsumption: typeof row.gasConsumption === 'number' ? row.gasConsumption : undefined,
          performance: typeof row.performance === 'number' ? row.performance : undefined,
          reliability: typeof row.reliability === 'number' ? row.reliability : undefined
        }));

        if (mappedComments.length > 0) {
          setComments(mappedComments);
          localStorage.setItem(`car_comments_${carCommentKey}`, JSON.stringify(mappedComments));
        } else {
          // If state is empty on server, check if there are any locally compiled comments
          const savedLocal = localStorage.getItem(`car_comments_${carCommentKey}`);
          if (savedLocal) {
            const parsed = JSON.parse(savedLocal);
            setComments(parsed);
            // Push local comments to Supabase to backend sync
            for (const col of parsed) {
              if (col.id !== "initial-1") {
                await supabase.from("comments").insert({
                  id: col.id.startsWith("temp-") ? `cmt-${Date.now()}-${Math.floor(Math.random() * 10000)}` : col.id,
                  car_id: carCommentKey,
                  author: col.author,
                  text: col.text,
                  timestamp: col.timestamp,
                  comfort: col.comfort,
                  gasConsumption: col.gasConsumption,
                  performance: col.performance,
                  reliability: col.reliability
                });
              }
            }
          } else {
            setComments([
              {
                id: "initial-1",
                author: "Whipcheck Expert",
                text: `Fantastic spot! The ${car.make} ${car.model} is an outstanding dynamic platform. Feel free to leave review notes, owner reviews or spotting locations below!`,
                timestamp: new Date().toLocaleDateString()
              }
            ]);
          }
        }
      } else {
        // Unconfigured fallback
        const response = await fetch(`/api/comments/${carCommentKey}`);
        if (response.ok) {
          const data = await response.json();
          if (data.comments && data.comments.length > 0) {
            setComments(data.comments);
            localStorage.setItem(`car_comments_${carCommentKey}`, JSON.stringify(data.comments));
          } else {
            const savedLocal = localStorage.getItem(`car_comments_${carCommentKey}`);
            if (savedLocal) {
              setComments(JSON.parse(savedLocal));
            } else {
              setComments([
                {
                  id: "initial-1",
                  author: "Whipcheck Expert",
                  text: `Fantastic spot! The ${car.make} ${car.model} is an outstanding dynamic platform. Feel free to leave review notes, owner reviews or spotting locations below!`,
                  timestamp: new Date().toLocaleDateString()
                }
              ]);
            }
          }
        } else {
          throw new Error("Local fallback failed");
        }
      }
    } catch (err) {
      console.warn("Could not load comments from Supabase or server, falling back to local simulation", err);
      const savedLocal = localStorage.getItem(`car_comments_${carCommentKey}`);
      if (savedLocal) {
        setComments(JSON.parse(savedLocal));
      } else {
        setComments([
          {
            id: "initial-1",
            author: "Whipcheck Expert",
            text: `Fantastic spot! The ${car.make} ${car.model} is an outstanding dynamic platform. Feel free to leave review notes, owner reviews or spotting locations below!`,
            timestamp: new Date().toLocaleDateString()
          }
        ]);
      }
    } finally {
      setIsLoadingComments(false);
    }
  };

  useEffect(() => {
    fetchComments();
    
    // Setup a live polling system to check for new comments on the same car from other users every 5 seconds!
    const interval = setInterval(() => {
      fetchComments();
    }, 5000);
    
    return () => clearInterval(interval);
  }, [carCommentKey]);

  // Mark all comments as viewed / acknowledged by the current user
  useEffect(() => {
    if (comments && comments.length > 0) {
      localStorage.setItem(`comments_last_seen_${carCommentKey}`, JSON.stringify({
        lastSeenCount: comments.length,
        lastSeenId: comments[comments.length - 1].id,
        timestamp: Date.now()
      }));
    }
  }, [comments, carCommentKey]);

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim()) return;

    if (selectedPlanTier === 'chiptuning') {
      if (comments.length >= 1) {
        setSubscriptionWarning("🔒 Chiptuning Free is limited to 1 custom note/discuss entry. Upgrade to Teen Passion for up to 5 entries.");
        setTimeout(() => setSubscriptionWarning(null), 5000);
        onOpenPlans?.('teen_passion');
        return;
      }
    } else if (selectedPlanTier === 'teen_passion') {
      if (comments.length >= 5) {
        setSubscriptionWarning("🔒 Teen Passion premium is limited to 5 custom note/discuss entries per car. Upgrade to Gasoline Gold for unlimited entries.");
        setTimeout(() => setSubscriptionWarning(null), 5000);
        onOpenPlans?.('gasoline_gold');
        return;
      }
    }

    const authorName = spotterUserName.trim() || "Anonymous Petrolhead";
    const commentBody = newCommentText.trim();

    // Optimistically add locally with a temporary ID
    const tempId = `temp-${Date.now()}`;
    const optimisticComment: ReportComment = {
      id: tempId,
      author: authorName,
      text: commentBody,
      timestamp: new Date().toLocaleDateString() + " " + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      comfort: ratingComfort > 0 ? ratingComfort : undefined,
      gasConsumption: ratingGas > 0 ? ratingGas : undefined,
      performance: ratingPerf > 0 ? ratingPerf : undefined,
      reliability: ratingReliability > 0 ? ratingReliability : undefined
    };

    setComments(prev => [...prev.filter(c => c.id !== "initial-1"), optimisticComment]);
    setNewCommentText("");
    
    // Reset inputs
    setRatingComfort(0);
    setRatingGas(0);
    setRatingPerf(0);
    setRatingReliability(0);

    try {
      if (isSupabaseConfigured() && supabase) {
        const { error } = await supabase.from("comments").insert({
          id: `cmt-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
          car_id: carCommentKey,
          author: authorName,
          text: commentBody,
          timestamp: optimisticComment.timestamp,
          comfort: ratingComfort > 0 ? ratingComfort : null,
          gasConsumption: ratingGas > 0 ? ratingGas : null,
          performance: ratingPerf > 0 ? ratingPerf : null,
          reliability: ratingReliability > 0 ? ratingReliability : null
        });
        if (error) throw error;
        await fetchComments();
      } else {
        const response = await fetch(`/api/comments/${carCommentKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            author: authorName, 
            text: commentBody,
            comfort: ratingComfort > 0 ? ratingComfort : undefined,
            gasConsumption: ratingGas > 0 ? ratingGas : undefined,
            performance: ratingPerf > 0 ? ratingPerf : undefined,
            reliability: ratingReliability > 0 ? ratingReliability : undefined
          })
        });

        if (response.ok) {
          const data = await response.json();
          if (data.comments) {
            setComments(data.comments);
            localStorage.setItem(`car_comments_${carCommentKey}`, JSON.stringify(data.comments));
          }
        } else {
          const updated = [...comments.filter(c => c.id !== tempId && c.id !== "initial-1"), optimisticComment];
          setComments(updated);
          localStorage.setItem(`car_comments_${carCommentKey}`, JSON.stringify(updated));
        }
      }
    } catch (err) {
      console.error("Failed to sync new comment to Supabase or backend pool", err);
      const updated = [...comments.filter(c => c.id !== tempId && c.id !== "initial-1"), optimisticComment];
      setComments(updated);
      localStorage.setItem(`car_comments_${carCommentKey}`, JSON.stringify(updated));
    }

    if (spotterUserName.trim()) {
      localStorage.setItem("whipcheck_spotter_name", spotterUserName.trim());
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    // Let them remove initial prompt locally
    if (commentId === "initial-1") {
      const updated = comments.filter(c => c.id !== commentId);
      setComments(updated);
      localStorage.setItem(`car_comments_${carCommentKey}`, JSON.stringify(updated));
      return;
    }

    // Filter optimistically
    setComments(prev => prev.filter(c => c.id !== commentId));

    try {
      if (isSupabaseConfigured() && supabase) {
        const { error } = await supabase.from("comments").delete().eq("id", commentId);
        if (error) throw error;
        await fetchComments();
      } else {
        const response = await fetch(`/api/comments/${carCommentKey}/${commentId}`, {
          method: "DELETE"
        });
        if (response.ok) {
          const data = await response.json();
          if (data.comments) {
            setComments(data.comments);
            localStorage.setItem(`car_comments_${carCommentKey}`, JSON.stringify(data.comments));
          }
        }
      }
    } catch (err) {
      console.error("Failed to delete comment from Supabase database", err);
      const updated = comments.filter(c => c.id !== commentId);
      localStorage.setItem(`car_comments_${carCommentKey}`, JSON.stringify(updated));
    }
  };

  // Generate a live Base64 share link
  const getShareLink = () => {
    try {
      const payload = btoa(unescape(encodeURIComponent(JSON.stringify(car))));
      return `${window.location.origin}${window.location.pathname}?share_car=${payload}`;
    } catch {
      return `${window.location.origin}${window.location.pathname}`;
    }
  };

  // Generate plain-text visual report for social media sharing
  const getShareText = () => {
    return `🚗 WHIPCHECK GT SPOTTER REPORT 🚗
⚡ Model: ${car.modelYear ? car.modelYear + ' ' : ''}${car.make} ${car.model}
🔥 Class: ${car.category}
⚙️ Powertrain: ${car.engineType} (${car.horsepower || car.power})
⏱️ 0-100 km/h: ${car.zeroToSixty}
💎 Resale Value: ${car.estimatedUsedPrice}
🎯 Spotter confidence: ${Math.round(car.confidence * 100)}%

Analyzed dynamically by Whipcheck GT Enthusiast Car Detector!`;
  };

  const handleCopyLink = () => {
    if (!checkAndRegisterBroadcast()) return;
    navigator.clipboard.writeText(getShareLink());
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyText = () => {
    if (!checkAndRegisterBroadcast()) return;
    navigator.clipboard.writeText(getShareText());
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  // Calculate dynamic colors based on confidence
  const confPercent = Math.round(car.confidence * 100);
  const isHighConf = car.confidence >= 0.8;
  const isMedConf = car.confidence >= 0.5 && car.confidence < 0.8;

  const confColor = isHighConf 
    ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" 
    : isMedConf 
    ? "text-amber-400 bg-amber-505/10 border-amber-500/20" 
    : "text-rose-400 bg-rose-505/10 border-rose-500/20";

  // Calculate rating stats
  const ratingStats = (() => {
    let countComfort = 0;
    let sumComfort = 0;
    
    let countGas = 0;
    let sumGas = 0;
    
    let countPerf = 0;
    let sumPerf = 0;
    
    let countReliability = 0;
    let sumReliability = 0;
    
    comments.forEach(c => {
      if (typeof c.comfort === 'number' && c.comfort > 0) {
        sumComfort += c.comfort;
        countComfort++;
      }
      if (typeof c.gasConsumption === 'number' && c.gasConsumption > 0) {
        sumGas += c.gasConsumption;
        countGas++;
      }
      if (typeof c.performance === 'number' && c.performance > 0) {
        sumPerf += c.performance;
        countPerf++;
      }
      if (typeof c.reliability === 'number' && c.reliability > 0) {
        sumReliability += c.reliability;
        countReliability++;
      }
    });
    
    const avgComfort = countComfort > 0 ? Number((sumComfort / countComfort).toFixed(1)) : 0;
    const avgGas = countGas > 0 ? Number((sumGas / countGas).toFixed(1)) : 0;
    const avgPerf = countPerf > 0 ? Number((sumPerf / countPerf).toFixed(1)) : 0;
    const avgReliability = countReliability > 0 ? Number((sumReliability / countReliability).toFixed(1)) : 0;
    
    // Overall Average calculation
    let totalScore = 0;
    let totalCount = 0;
    if (avgComfort > 0) { totalScore += avgComfort; totalCount++; }
    if (avgGas > 0) { totalScore += avgGas; totalCount++; }
    if (avgPerf > 0) { totalScore += avgPerf; totalCount++; }
    if (avgReliability > 0) { totalScore += avgReliability; totalCount++; }
    
    const overallAvg = totalCount > 0 ? Number((totalScore / totalCount).toFixed(1)) : 0;
    const ratingsCount = Math.max(countComfort, countGas, countPerf, countReliability);
    
    return {
      avgComfort,
      countComfort,
      avgGas,
      countGas,
      avgPerf,
      countPerf,
      avgReliability,
      countReliability,
      overallAvg,
      ratingsCount
    };
  })();

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
            {car.modelYear ? `${car.modelYear} ` : ""}{car.make} {car.model}
          </h1>
          <p className="text-xs text-amber-300 font-mono mt-1 font-semibold drop-shadow-md">
            {car.generation !== "N/A" && `${car.generation} • `}Production Span: {car.yearRange}
          </p>
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* Powertrain */}
        <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800/80 space-y-1">
          <div className="flex items-center gap-1.5 text-blue-400 text-[10px] font-mono uppercase font-bold tracking-wider">
            <Settings2 className="h-3.5 w-3.5 text-blue-400" />
            <span>Powertrain</span>
          </div>
          <p className="text-xs font-bold text-slate-100 line-clamp-2 leading-relaxed">{car.engineType}</p>
        </div>

        {/* Acceleration */}
        <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800/80 space-y-1">
          <div className="flex items-center gap-1.5 text-purple-400 text-[10px] font-mono uppercase font-bold tracking-wider">
            <Gauge className="h-3.5 w-3.5 text-purple-400" />
            <span>0-100 KM/H</span>
          </div>
          <p className="text-xs font-bold text-slate-100">{car.zeroToSixty}</p>
        </div>

        {/* Brand New Value */}
        <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800/80 space-y-1">
          <div className="flex items-center gap-1.5 text-emerald-400 text-[10px] font-mono uppercase font-bold tracking-wider">
            <span className="w-3.5 h-3.5 flex items-center justify-center bg-emerald-500/15 text-emerald-400 rounded-full font-bold text-[9px]">E</span>
            <span>Est. New (EGP)</span>
          </div>
          <p className="text-xs font-bold text-emerald-300">{car.estimatedNewPrice}</p>
        </div>

        {/* Market Value Used */}
        <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800/80 space-y-1">
          <div className="flex items-center gap-1.5 text-pink-400 text-[10px] font-mono uppercase font-bold tracking-wider">
            <span className="w-3.5 h-3.5 flex items-center justify-center bg-pink-500/15 text-pink-400 rounded-full font-bold text-[9px]">E</span>
            <span>Resale (EGP)</span>
          </div>
          <p className="text-xs font-bold text-pink-300 font-mono">{car.estimatedUsedPrice}</p>
        </div>
      </div>

      {/* Engineering Specs Block */}
      <div className="bg-slate-900/20 p-4 rounded-xl border border-slate-850 space-y-3">
        <h3 className="text-[10px] font-mono tracking-widest text-amber-400 uppercase font-bold">Mechanical Specifications</h3>
        
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800/60 shadow-inner">
            <span className="block text-[8px] font-mono text-zinc-400 uppercase tracking-wider font-semibold">Transmission</span>
            <span className="text-[10px] font-bold text-slate-100 block mt-1 line-clamp-1">{car.specs.transmission}</span>
          </div>
          <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800/60 shadow-inner">
            <span className="block text-[8px] font-mono text-zinc-400 uppercase tracking-wider font-semibold">Drivetrain</span>
            <span className="text-[10px] font-bold text-slate-100 block mt-1 uppercase font-mono">{car.specs.driveType}</span>
          </div>
          <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800/60 shadow-inner">
            <span className="block text-[8px] font-mono text-zinc-400 uppercase tracking-wider font-semibold">Fuel / Range</span>
            <span className="text-[10px] font-bold text-emerald-400 block mt-1 line-clamp-1">{car.specs.fuelEconomy}</span>
          </div>
          <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800/60 shadow-inner">
            <span className="block text-[8px] font-mono text-zinc-400 uppercase tracking-wider font-semibold">Horsepower</span>
            <span className="text-[10px] font-bold text-yellow-400 block mt-1 line-clamp-1">{car.horsepower || car.power}</span>
          </div>
          <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800/60 shadow-inner">
            <span className="block text-[8px] font-mono text-zinc-400 uppercase tracking-wider font-semibold">Torque</span>
            <span className="text-[10px] font-bold text-orange-400 block mt-1 line-clamp-1">{car.torque}</span>
          </div>
          <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800/60 shadow-inner">
            <span className="block text-[8px] font-mono text-zinc-400 uppercase tracking-wider font-semibold">Model Year</span>
            <span className="text-[10px] font-bold text-blue-400 block mt-1 line-clamp-1">{car.modelYear}</span>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2.5 border-t border-slate-800 text-xs">
          <span className="text-slate-200 font-medium flex items-center gap-1.5 font-mono">
            <Palette className="h-4 w-4 text-emerald-400" /> Paint Color:
          </span>
          <div className="flex items-center gap-2">
            <span className="px-3.5 py-1.5 bg-slate-900 text-slate-50 border border-slate-700 font-bold text-xs rounded-xl shadow-lg capitalize flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded-full border border-white/20 shadow-inner" style={{ backgroundColor: getVisualColorHex(car.color) }}></span>
              {car.color}
            </span>
          </div>
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

      {/* Dynamic Share Module */}
      <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-850 space-y-3 shadow-md relative overflow-hidden">
        {selectedPlanTier === 'teen_passion' && (
          <div className="absolute top-1 right-2 text-[8px] font-mono text-indigo-400 font-bold uppercase">
            Broadcasts: {3 - broadcastCountUsed}/3 remaining
          </div>
        )}
        {selectedPlanTier === 'chiptuning' && (
          <div className="absolute top-1 right-2 text-[8px] font-mono text-zinc-500 font-bold uppercase">
            Broadcasts: Locked 🔒
          </div>
        )}
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 px-0.5">
            <Share2 className="h-3.5 w-3.5 text-teal-400" />
            <h3 className="text-xs font-bold text-slate-200 font-display uppercase tracking-wider">Broadcast Spotter Card</h3>
          </div>
          <span className="text-[8px] font-mono text-emerald-400 uppercase tracking-widest bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-500/10">Active</span>
        </div>

        {subscriptionWarning && (
          <div className="p-2 bg-indigo-950/80 border border-indigo-500/30 text-indigo-300 rounded-lg text-[9.5px] font-mono leading-tight animate-pulse text-center">
            {subscriptionWarning}
          </div>
        )}

        <div className="space-y-2.5">
          <p className="text-[10px] text-zinc-400 leading-relaxed">
            Generate and broadcast this spotted vehicle configuration on global channels.
          </p>
          
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleCopyLink}
              className="flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-950 hover:bg-slate-900 text-slate-200 text-[10px] font-mono rounded-lg border border-slate-800 transition cursor-pointer"
            >
              {copiedLink ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  <span className="text-emerald-400 font-bold font-mono">Link Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5 text-sky-400 shrink-0" />
                  <span>Copy Spotter Link</span>
                </>
              )}
            </button>

            <button
              onClick={handleCopyText}
              className="flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-950 hover:bg-slate-900 text-slate-200 text-[10px] font-mono rounded-lg border border-slate-800 transition cursor-pointer"
            >
              {copiedText ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  <span className="text-emerald-400 font-bold font-mono">Text Copied!</span>
                </>
              ) : (
                <>
                  <MessageSquare className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  <span>Copy Text Report</span>
                </>
              )}
            </button>
          </div>

          {/* Social quick share links */}
          <div className="flex items-center gap-2 pt-0.5 justify-center">
            <a
              href={`https://api.whatsapp.com/send?text=${encodeURIComponent(getShareText() + "\n\n🌐 View Live Spotter Pass: " + getShareLink())}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                if (!checkAndRegisterBroadcast()) {
                  e.preventDefault();
                }
              }}
              className="px-3 py-1 bg-emerald-500/10 hover:bg-emerald-500/25 text-emerald-400 text-[9px] font-mono border border-emerald-500/20 rounded-md transition font-semibold"
            >
              WhatsApp
            </a>
            <a
              href={`https://twitter.com/intent/tweet?text=${encodeURIComponent("Check out this " + car.make + " " + car.model + " I spotted and analyzed! Speed specs, resale estimated pricing, trivia & buyer advice on Whipcheck GT.")}&url=${encodeURIComponent(getShareLink())}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                if (!checkAndRegisterBroadcast()) {
                  e.preventDefault();
                }
              }}
              className="px-3 py-1 bg-sky-500/10 hover:bg-sky-500/25 text-sky-400 text-[9px] font-mono border border-sky-500/20 rounded-md transition font-semibold"
            >
              Share on X
            </a>
          </div>
        </div>
      </div>

      {/* Spotter Discussion Board & Logbook */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 px-1">
          <MessageSquare className="h-3.5 w-3.5 text-amber-500" />
          <h3 className="text-xs font-bold text-slate-200 font-display uppercase tracking-wider">Spotter Notes & Discussion ({comments.length})</h3>
        </div>

        <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-850 space-y-4 shadow-md">
          {/* Community rating scorecard if there's any active rating info */}
          {ratingStats.ratingsCount > 0 && (
            <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-850/85 space-y-2.5">
              <div className="flex items-center justify-between border-b border-slate-850/65 pb-2">
                <div>
                  <h4 className="text-[11px] font-black uppercase text-slate-300 tracking-wider font-mono">Community Scoreboard</h4>
                  <p className="text-[9px] text-zinc-500 uppercase font-mono mt-0.5">Driving attributes aggregated ratings</p>
                </div>
                <div className="flex flex-col items-end">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[13px] font-black font-mono text-amber-400">{ratingStats.overallAvg.toFixed(1)}</span>
                    {renderStars(ratingStats.overallAvg)}
                  </div>
                  <span className="text-[8px] text-zinc-500 font-mono uppercase mt-0.5">({ratingStats.ratingsCount} review{ratingStats.ratingsCount > 1 ? 's' : ''})</span>
                </div>
              </div>

              {/* Detailed Breakdown Grid */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 pt-1 font-mono">
                {ratingStats.avgPerf > 0 && (
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-zinc-500 uppercase">Performance</span>
                    <div className="flex items-center gap-1.5 text-slate-400 font-bold">
                      <span>{ratingStats.avgPerf.toFixed(1)}</span>
                      {renderStars(ratingStats.avgPerf)}
                    </div>
                  </div>
                )}
                {ratingStats.avgComfort > 0 && (
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-zinc-500 uppercase">Comfort</span>
                    <div className="flex items-center gap-1.5 text-slate-400 font-bold">
                      <span>{ratingStats.avgComfort.toFixed(1)}</span>
                      {renderStars(ratingStats.avgComfort)}
                    </div>
                  </div>
                )}
                {ratingStats.avgGas > 0 && (
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-zinc-500 uppercase">Fuel Economy</span>
                    <div className="flex items-center gap-1.5 text-slate-400 font-bold">
                      <span>{ratingStats.avgGas.toFixed(1)}</span>
                      {renderStars(ratingStats.avgGas)}
                    </div>
                  </div>
                )}
                {ratingStats.avgReliability > 0 && (
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-zinc-500 uppercase">Reliability</span>
                    <div className="flex items-center gap-1.5 text-slate-400 font-bold">
                      <span>{ratingStats.avgReliability.toFixed(1)}</span>
                      {renderStars(ratingStats.avgReliability)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Comments list */}
          <div className="space-y-3 max-h-56 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-800">
            {comments.length === 0 ? (
              <p className="text-[10px] text-slate-500 text-center py-2 font-mono uppercase">
                No custom notes registered for this model yet.
              </p>
            ) : (
              comments.map((cmt) => (
                <div key={cmt.id} className="bg-slate-950/70 p-2.5 rounded-lg border border-slate-850/80 flex flex-col gap-1.5 relative group">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center text-[8.5px] font-mono font-bold uppercase border border-amber-500/20 shrink-0 shadow-sm">
                        {cmt.author ? cmt.author[0] : "S"}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                        <span className="text-[10px] font-extrabold text-amber-400 font-mono">
                          {cmt.author}
                        </span>
                        <span className="text-[8.5px] text-slate-400 font-medium px-1.5 py-0.5 rounded bg-zinc-805 border border-zinc-800/40">
                          {cmt.timestamp}
                        </span>
                      </div>
                    </div>

                    {(cmt.author === spotterUserName || sessionStorage.getItem("whipcheck_admin_session") === "true") && (
                      <button
                        onClick={() => handleDeleteComment(cmt.id)}
                        className="text-red-400 hover:text-red-300 opacity-60 hover:opacity-100 transition duration-150 p-1 cursor-pointer shrink-0"
                        title="Delete your comment"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>

                  {/* Spotter feedback individual ratings breakdown */}
                  {(cmt.comfort || cmt.gasConsumption || cmt.performance || cmt.reliability) && (
                    <div className="flex flex-wrap gap-1.5 items-center pl-7 py-0.5 font-mono text-[8.5px]">
                      {cmt.performance && (
                        <span className="inline-flex items-center gap-1 bg-[#f43f5e]/5 px-1.5 py-0.5 rounded border border-[#f43f5e]/15 text-[#fb7185]">
                          <span>Perf:</span>
                          {renderStars(cmt.performance)}
                        </span>
                      )}
                      {cmt.comfort && (
                        <span className="inline-flex items-center gap-1 bg-[#0ea5e9]/5 px-1.5 py-0.5 rounded border border-[#0ea5e9]/15 text-[#38bdf8]">
                          <span>Comfort:</span>
                          {renderStars(cmt.comfort)}
                        </span>
                      )}
                      {cmt.gasConsumption && (
                        <span className="inline-flex items-center gap-1 bg-[#10b981]/5 px-1.5 py-0.5 rounded border border-[#10b981]/15 text-[#34d399]">
                          <span>Fuel:</span>
                          {renderStars(cmt.gasConsumption)}
                        </span>
                      )}
                      {cmt.reliability && (
                        <span className="inline-flex items-center gap-1 bg-[#8b5cf6]/5 px-1.5 py-0.5 rounded border border-[#8b5cf6]/15 text-[#a78bfa]">
                          <span>Build:</span>
                          {renderStars(cmt.reliability)}
                        </span>
                      )}
                    </div>
                  )}

                  <p className="text-[11px] text-zinc-300 leading-relaxed pl-7 font-sans break-words whitespace-pre-line">
                    {cmt.text}
                  </p>
                </div>
              ))
            )}
          </div>

          {/* New Comment submission */}
          <form onSubmit={handleAddComment} className="border-t border-slate-850/85 pt-3 space-y-2.5">
            <div className="grid grid-cols-3 gap-2 items-center">
              <label className="text-[9px] font-mono text-slate-500 uppercase tracking-wider pl-0.5">Spotter Alias</label>
              <input
                type="text"
                value={spotterUserName}
                onChange={(e) => setSpotterUserName(e.target.value)}
                placeholder="Name"
                className="col-span-2 bg-slate-950 border border-slate-800 rounded-md text-[10px] text-slate-250 px-2 py-1 font-mono focus:outline-none focus:border-amber-400/50"
                maxLength={20}
              />
            </div>

            {/* Structured Star Ratings Panel */}
            <div className="bg-slate-950/50 rounded-lg border border-slate-850 p-2.5 space-y-1">
              <span className="text-[8px] text-slate-500 uppercase tracking-widest block pl-0.5 mb-1 font-mono font-bold">Assess Vehicle Attributes (Optional)</span>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                <StarRatingInput label="Ride Comfort" value={ratingComfort} onChange={setRatingComfort} />
                <StarRatingInput label="Fuel Economy (Gas)" value={ratingGas} onChange={setRatingGas} />
                <StarRatingInput label="Performance / Power" value={ratingPerf} onChange={setRatingPerf} />
                <StarRatingInput label="Reliability / Build" value={ratingReliability} onChange={setRatingReliability} />
              </div>
            </div>

            {/* Plan Counter Status for Notes/Reviews */}
            <div className="flex justify-between items-center text-[8px] font-mono uppercase tracking-wider px-1 text-slate-500">
              <span>Discussion Board Notes</span>
              {selectedPlanTier === 'chiptuning' ? (
                <span className={comments.length >= 1 ? "text-amber-500 font-bold animate-pulse" : "text-emerald-400"}>Chiptuning Limit: {comments.length}/1 logged</span>
              ) : selectedPlanTier === 'teen_passion' ? (
                <span className={comments.length >= 5 ? "text-amber-500 font-bold animate-pulse" : "text-indigo-400"}>Teen Passion Limit: {comments.length}/5 logged</span>
              ) : (
                <span className="text-amber-400 font-black">Gasoline Gold: Unlimited ♾️</span>
              )}
            </div>

            <div className="relative flex items-center">
              <textarea
                value={newCommentText}
                onChange={(e) => setNewCommentText(e.target.value)}
                placeholder="Log spotting notes, custom setups, or owner reviews..."
                rows={2}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg text-[10.5px] text-slate-200 p-2 pr-10 focus:outline-none focus:border-amber-400/50 resize-none font-sans"
                maxLength={250}
              />
              <button
                type="submit"
                disabled={!newCommentText.trim()}
                className="absolute right-2 px-2.5 py-1.5 rounded-md bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 disabled:opacity-40 border border-amber-500/20 text-[9px] font-mono uppercase font-black transition cursor-pointer"
              >
                Log
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* App Actions Frame */}
      {saveError && (
        <div className="p-3 bg-red-950/40 border border-red-500/20 rounded-xl text-red-100 text-[10.5px] leading-relaxed flex items-center gap-2 font-mono animate-fade-in mb-3">
          <ShieldAlert className="h-4 w-4 shrink-0 text-red-500 animate-pulse" />
          <span>{saveError}</span>
        </div>
      )}

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
