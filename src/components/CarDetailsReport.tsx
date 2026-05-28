import React, { useState, useEffect } from "react";
import { IdentifiedCar, getNormalizedCarKey } from "../types";
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

  const carCommentKey = getNormalizedCarKey(car);

  // Comments state with live backend synchronization
  const [comments, setComments] = useState<{ id: string; author: string; text: string; timestamp: string }[]>([]);
  const [isLoadingComments, setIsLoadingComments] = useState(false);

  const [newCommentText, setNewCommentText] = useState("");
  const [spotterUserName, setSpotterUserName] = useState(() => {
    return localStorage.getItem("whipcheck_spotter_name") || `Spotter_${Math.floor(1000 + Math.random() * 9000)}`;
  });

  const [showSharePanel, setShowSharePanel] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedText, setCopiedText] = useState(false);

  // Load comments from the API with local storage backup fallback
  const fetchComments = async () => {
    setIsLoadingComments(true);
    try {
      const response = await fetch(`/api/comments/${carCommentKey}`);
      if (response.ok) {
        const data = await response.json();
        if (data.comments && data.comments.length > 0) {
          setComments(data.comments);
          localStorage.setItem(`car_comments_${carCommentKey}`, JSON.stringify(data.comments));
        } else {
          // If state is empty on server, check if there are any locally compiled legacy comments
          const savedLocal = localStorage.getItem(`car_comments_${carCommentKey}`);
          if (savedLocal) {
            const parsed = JSON.parse(savedLocal);
            setComments(parsed);
            // Push legacy local comments to server to sync
            for (const col of parsed) {
              if (col.id !== "initial-1") {
                await fetch(`/api/comments/${carCommentKey}`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ author: col.author, text: col.text })
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
      }
    } catch (err) {
      console.warn("Could not connect to comments API, falling back to local simulation", err);
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

    const authorName = spotterUserName.trim() || "Anonymous Petrolhead";
    const commentBody = newCommentText.trim();

    // Optimistically add locally with a temporary ID
    const tempId = `temp-${Date.now()}`;
    const optimisticComment = {
      id: tempId,
      author: authorName,
      text: commentBody,
      timestamp: new Date().toLocaleDateString() + " " + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setComments(prev => [...prev.filter(c => c.id !== "initial-1"), optimisticComment]);
    setNewCommentText("");

    try {
      const response = await fetch(`/api/comments/${carCommentKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ author: authorName, text: commentBody })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.comments) {
          setComments(data.comments);
          localStorage.setItem(`car_comments_${carCommentKey}`, JSON.stringify(data.comments));
        }
      } else {
        // Fallback save to localStorage if server returns non-OK status
        const updated = [...comments.filter(c => c.id !== tempId && c.id !== "initial-1"), optimisticComment];
        setComments(updated);
        localStorage.setItem(`car_comments_${carCommentKey}`, JSON.stringify(updated));
      }
    } catch (err) {
      console.error("Failed to sync new comment to backend pool", err);
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
    } catch (err) {
      console.error("Failed to delete comment from backend database", err);
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
    navigator.clipboard.writeText(getShareLink());
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyText = () => {
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
      <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-850 space-y-3 shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 px-0.5">
            <Share2 className="h-3.5 w-3.5 text-teal-400" />
            <h3 className="text-xs font-bold text-slate-200 font-display uppercase tracking-wider">Broadcast Spotter Card</h3>
          </div>
          <span className="text-[8px] font-mono text-emerald-400 uppercase tracking-widest bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-500/10">Active</span>
        </div>

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
              className="px-3 py-1 bg-emerald-500/10 hover:bg-emerald-500/25 text-emerald-400 text-[9px] font-mono border border-emerald-500/20 rounded-md transition font-semibold"
            >
              WhatsApp
            </a>
            <a
              href={`https://twitter.com/intent/tweet?text=${encodeURIComponent("Check out this " + car.make + " " + car.model + " I spotted and analyzed! Speed specs, resale estimated pricing, trivia & buyer advice on Whipcheck GT.")}&url=${encodeURIComponent(getShareLink())}`}
              target="_blank"
              rel="noopener noreferrer"
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
          {/* Comments list */}
          <div className="space-y-3 max-h-48 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-800">
            {comments.length === 0 ? (
              <p className="text-[10px] text-slate-500 text-center py-2 font-mono uppercase">
                No custom notes registered for this model yet.
              </p>
            ) : (
              comments.map((cmt) => (
                <div key={cmt.id} className="bg-slate-950/70 p-2.5 rounded-lg border border-slate-850/80 flex flex-col gap-1 relative group">
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

                    <button
                      onClick={() => handleDeleteComment(cmt.id)}
                      className="text-red-400 hover:text-red-300 opacity-60 hover:opacity-100 transition duration-150 p-1 cursor-pointer shrink-0"
                      title="Delete your comment"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                  <p className="text-[11px] text-zinc-300 leading-relaxed pl-5 font-sans break-words whitespace-pre-line">
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
