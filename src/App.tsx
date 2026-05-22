import React, { useState, useEffect, useRef } from "react";
import { 
  Camera as CameraIcon, Upload, Sparkles, History, Compass, Database, 
  Trash2, ShieldAlert, CheckCircle2, ChevronRight, RotateCcw, 
  MapPin, Loader2, Gauge, Settings, Cpu, HelpCircle, RefreshCw, Layers, ShieldCheck
} from "lucide-react";
import { IdentifiedCar, ScanStepType } from "./types";
import StatusIndicator from "./components/StatusIndicator";
import SampleCarousel from "./components/SampleCarousel";
import GuideSection from "./components/GuideSection";
import CarDetailsReport from "./components/CarDetailsReport";

const HOTSPOTS = [
  { name: "Daikoku Parking Area, Yokohama", coords: "35.4612° N, 139.6714° E" },
  { name: "Nürburgring Boulevard, Germany", coords: "50.3341° N, 6.9427° E" },
  { name: "Casino Square, Monaco", coords: "43.7391° N, 7.4273° E" },
  { name: "Beverly Hills, California", coords: "34.0736° N, 118.4004° W" },
  { name: "Yas Marina Circuit, Abu Dhabi", coords: "24.4672° N, 54.6067° E" }
];

export default function App() {
  // Mobile UI Tabs: 'scan' | 'garage' | 'guide'
  const [activeTab, setActiveTab] = useState<'scan' | 'garage' | 'guide'>('scan');
  
  // Scans history & collection garage
  const [garage, setGarage] = useState<IdentifiedCar[]>([]);
  const [selectedGarageCar, setSelectedGarageCar] = useState<IdentifiedCar | null>(null);

  // Scan workflow state
  const [scanStep, setScanStep] = useState<ScanStepType>('idle');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [identifiedCar, setIdentifiedCar] = useState<IdentifiedCar | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loadingStatusText, setLoadingStatusText] = useState<string>("Initializing...");

  // Camera references
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Simulated GPS or Real Geolocation
  const [gpsCoords, setGpsCoords] = useState(HOTSPOTS[0].coords);
  const [gpsName, setGpsName] = useState(HOTSPOTS[0].name);

  // Initialize and load saved garage items
  useEffect(() => {
    try {
      const saved = localStorage.getItem("car_spotter_garage_v2");
      if (saved) {
        setGarage(JSON.parse(saved));
      }
    } catch (e) {
      console.error("Failed to load local garage items", e);
    }

    // Try fetching real geolocation
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude.toFixed(4);
          const lng = position.coords.longitude.toFixed(4);
          setGpsCoords(`${lat}° N, ${lng}° E`);
          setGpsName("Local GPS Tracker");
        },
        () => {
          // Fallback to random cool automotive hotspot
          const randomSpot = HOTSPOTS[Math.floor(Math.random() * HOTSPOTS.length)];
          setGpsCoords(randomSpot.coords);
          setGpsName(randomSpot.name);
        }
      );
    }
  }, []);

  // Sync garage with localstorage
  const saveToGarage = (car: IdentifiedCar) => {
    if (!car) return;
    const exists = garage.some(c => c.id === car.id);
    if (!exists) {
      const updated = [car, ...garage];
      setGarage(updated);
      localStorage.setItem("car_spotter_garage_v2", JSON.stringify(updated));
    }
  };

  const removeFromGarage = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const updated = garage.filter(c => c.id !== id);
    setGarage(updated);
    localStorage.setItem("car_spotter_garage_v2", JSON.stringify(updated));
    if (selectedGarageCar && selectedGarageCar.id === id) {
      setSelectedGarageCar(null);
    }
  };

  // Turn camera on/off
  const startCamera = async () => {
    stopCamera();
    setScanStep('capture');
    setErrorMsg(null);
    try {
      const constraints = {
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err: any) {
      console.warn("Camera access denied or unavailable, switching to file uploader.", err);
      // Fallback
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  // Close camera on cleanups
  useEffect(() => {
    return () => stopCamera();
  }, []);

  // Handle uploaded file
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processSelectedImageFile(file);
    }
  };

  const processSelectedImageFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setImageUrl(base64);
      analyzeCarImage(base64, null);
    };
    reader.onerror = () => {
      setErrorMsg("Failed to read image file.");
    };
    reader.readAsDataURL(file);
  };

  // Capture frame from active camera stream
  const capturePhoto = () => {
    if (!videoRef.current) return;
    try {
      const video = videoRef.current;
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        // Draw the video frame to canvas
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
        setImageUrl(dataUrl);
        stopCamera();
        analyzeCarImage(dataUrl, null);
      }
    } catch (err) {
      setErrorMsg("Could not capture frame. Try uploading an image instead.");
    }
  };

  // Handle sample click
  const handleSelectSample = (sampleUrl: string) => {
    setImageUrl(sampleUrl);
    analyzeCarImage(null, sampleUrl);
  };

  // Trigger Gemini API Request
  const analyzeCarImage = async (base64Data: string | null, urlData: string | null) => {
    setErrorMsg(null);
    setIdentifiedCar(null);
    setScanStep('uploading');
    setLoadingStatusText("UPLOADING FRAME TO VISION CLOUD...");

    // Simulated staggered vision processing loader steps for high fidelity density theme UI
    const steps = [
      { text: "ESTABLISHING SHADOW CONTOURS...", time: 700 },
      { text: "MATCHING CHASSIS SIGNATURES...", time: 1400 },
      { text: "RESOLVING VEHICLE MARKINGS...", time: 2100 },
      { text: "QUERYING AUTOMOTIVE BLUEPRINTS...", time: 2700 }
    ];

    steps.forEach((s) => {
      setTimeout(() => {
        setScanStep((prev) => {
          if (prev !== 'error' && prev !== 'done' && prev !== 'idle') {
            setLoadingStatusText(s.text);
          }
          return prev;
        });
      }, s.time);
    });

    try {
      const res = await fetch("/api/identify-car", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: base64Data,
          imageUrl: urlData
        })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Server responded with ${res.status}`);
      }

      const parsedResult = await res.json();
      
      // Inject simulated id and timestamp
      const carResult: IdentifiedCar = {
        ...parsedResult,
        id: Math.random().toString(36).substr(2, 9),
        timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        image: base64Data || urlData || "https://images.unsplash.com/photo-1542282088-fe8426682b8f?auto=format&fit=crop&q=80&w=600"
      };

      setIdentifiedCar(carResult);
      setScanStep('done');
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Communication protocol failed during neural vision scan.");
      setScanStep('error');
    }
  };

  const triggerReset = () => {
    setImageUrl(null);
    setIdentifiedCar(null);
    setErrorMsg(null);
    setScanStep('idle');
    stopCamera();
  };

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-slate-350 flex flex-col font-sans select-none antialiased md:py-6 md:px-4">
      
      {/* Primary Container - Sized like a sleek modern mobile app on desktop, fully fluid on mobile */}
      <div className="w-full max-w-md mx-auto bg-[#0f0f12] border-0 md:border md:border-slate-800 md:rounded-3xl shadow-2xl shadow-blue-950/20 flex flex-col overflow-hidden min-h-screen md:min-h-[840px] relative">
        
        {/* HUD Scanner Top Bar Grid */}
        <header className="p-4 border-b border-slate-850 bg-slate-900/35 relative overflow-hidden shrink-0">
          <div className="absolute top-0 right-0 h-16 w-16 bg-blue-500/5 rounded-full blur-xl pointer-events-none"></div>
          
          <div className="flex items-center justify-between relative z-10">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded bg-blue-500 animate-pulse"></span>
                <h1 className="text-sm font-black tracking-widest text-slate-100 font-display">WHIPCHECK v4.5</h1>
              </div>
              <p className="text-[10px] text-blue-500 font-mono tracking-wider">CHASSIS VISION ENGINE: ONLINE</p>
            </div>

            <div className="text-right">
              <span className="text-[9px] font-mono text-slate-500 block uppercase">Spotter Location</span>
              <span className="text-[10px] font-mono text-blue-500 font-bold truncate max-w-[150px] inline-block">{gpsCoords}</span>
            </div>
          </div>
        </header>

        {/* Real-time Health Status banner */}
        <div className="bg-[#0c0c0e] px-4 py-2 border-b border-slate-850/65 flex justify-between items-center text-[10px] font-mono">
          <div className="flex items-center gap-1">
            <Cpu className="h-3.5 w-3.5 text-blue-500" />
            <span className="text-slate-400">GPS Tracker:</span>
            <span className="text-slate-200 truncate max-w-[160px]">{gpsName}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
            <span className="text-emerald-400 font-bold">API ACTIVE</span>
          </div>
        </div>

        {/* Dynamic App Body Workspace (Flowing or Scrolling) */}
        <main className="flex-1 overflow-y-auto p-4 space-y-5">
          
          {/* TAB 1: VISION SCANNER SCREEN */}
          {activeTab === 'scan' && (
            <div className="space-y-5">
              
              {/* Scan Workspace Frame Selector */}
              {scanStep === 'idle' && (
                <div className="space-y-4">
                  {/* Futuristic Interactive Viewport Hero */}
                  <div className="p-6 rounded-2xl border border-slate-800 bg-[#0a0a0c] text-center relative overflow-hidden group">
                    <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(#3b82f6 1px, transparent 1px)", backgroundSize: "16px 16px" }}></div>
                    
                    {/* Viewport Brackets decoration */}
                    <div className="absolute top-3 left-3 w-4 h-4 border-t border-l border-blue-500/60"></div>
                    <div className="absolute top-3 right-3 w-4 h-4 border-t border-r border-blue-500/60"></div>
                    <div className="absolute bottom-3 left-3 w-4 h-4 border-b border-l border-blue-500/60"></div>
                    <div className="absolute bottom-3 right-3 w-4 h-4 border-b border-r border-blue-500/60"></div>

                    <div className="my-3 flex justify-center">
                      <div className="p-3.5 bg-blue-600/10 text-blue-400 rounded-2xl border border-blue-500/30 group-hover:scale-110 transition-transform duration-300">
                        <CameraIcon className="w-8 h-8" />
                      </div>
                    </div>
                    
                    <h2 className="text-sm font-bold text-slate-100 font-display uppercase tracking-wide">Acquire Target Vehicle</h2>
                    <p className="text-xs text-slate-400 mt-2 max-w-xs mx-auto leading-relaxed">
                      Initialize the mobile camera alignment view or select a stored file to automatically extract model configurations.
                    </p>

                    <div className="grid grid-cols-2 gap-3 mt-5">
                      <button
                        onClick={startCamera}
                        className="flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs py-3 px-2 rounded-xl transition cursor-pointer"
                      >
                        <CameraIcon className="h-4 w-4" />
                        <span>Live Camera</span>
                      </button>

                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center justify-center gap-1.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-200 font-bold text-xs py-3 px-2 rounded-xl transition cursor-pointer"
                      >
                        <Upload className="h-4 w-4" />
                        <span>Upload File</span>
                      </button>
                    </div>

                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      accept="image/*"
                      className="hidden"
                    />
                  </div>

                  {/* Active Samples Gallery */}
                  <SampleCarousel onSelectSample={handleSelectSample} disabled={false} />

                  {/* Quick System Calibration info */}
                  <div className="p-3 bg-slate-900/30 border border-slate-850 rounded-xl space-y-1 text-[10px] font-mono">
                    <span className="text-slate-400 block tracking-wider font-semibold uppercase">System Telemetry Log</span>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Lens Aperture</span>
                      <span className="text-slate-350">f/1.8 Auto Calibration</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Grid Resolution</span>
                      <span className="text-slate-350">2560 x 1440 HD Matrix</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Camera Viewport Active */}
              {scanStep === 'capture' && (
                <div className="space-y-4">
                  <div className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-black border border-blue-500/50">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      className="w-full h-full object-cover"
                    />

                    {/* Scanner High Density Overlay decoration */}
                    <div className="absolute inset-0 pointer-events-none">
                      {/* Grid Target Frame */}
                      <div className="absolute inset-8 border border-blue-500/20 rounded-lg">
                        <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-blue-400"></div>
                        <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-blue-400"></div>
                        <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-blue-400"></div>
                        <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-blue-400"></div>
                        
                        {/* Horizontal Pulsing scan sweep laser */}
                        <div className="scanner-laser absolute left-0 right-0 h-1 bg-blue-500/80 shadow-[0_0_10px_rgba(59,130,246,0.8)] filter blur-[1px]"></div>
                      </div>

                      {/* Diagnostic HUD coordinates info overlay */}
                      <div className="absolute top-3 left-4 bg-black/70 backdrop-blur-md px-2 py-1 rounded border border-blue-500/20 text-[8px] font-mono text-blue-400">
                        RADAR_SIG: [ONLINE]
                        <div className="text-[7px] text-slate-400 mt-0.5">VELOCITY: 0.0 KM/H</div>
                      </div>

                      <div className="absolute bottom-3 right-4 bg-black/70 backdrop-blur-md px-2 py-1 rounded border border-blue-500/20 text-[8px] font-mono text-blue-400">
                        SIGHT SCANNER IP
                        <div className="text-[7px] text-slate-400 mt-0.5">ISO 400 | AF_C</div>
                      </div>
                    </div>
                  </div>

                  {/* Camera Control Action buttons */}
                  <div className="flex gap-3 justify-center items-center">
                    <button
                      onClick={triggerReset}
                      className="px-4 py-3 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-350 text-xs font-semibold rounded-xl flex items-center gap-1 transition cursor-pointer"
                    >
                      <RotateCcw className="h-4 w-4" /> Reset
                    </button>

                    <button
                      onClick={capturePhoto}
                      className="w-16 h-16 rounded-full border-4 border-blue-600 bg-white/5 hover:bg-blue-600/10 flex items-center justify-center shadow-[0_0_20px_rgba(59,130,246,0.4)] transition duration-300 transform active:scale-95 cursor-pointer"
                    >
                      <div className="w-10 h-10 rounded-full bg-blue-500"></div>
                    </button>

                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-3 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-350 text-xs font-semibold rounded-xl flex items-center gap-1 transition cursor-pointer"
                    >
                      <Upload className="h-4 w-4" /> Gallery
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3: Loading States with Immersive Tech Steps */}
              {(scanStep === 'uploading' || scanStep === 'enhancing' || scanStep === 'parsing_vision') && (
                <div className="p-8 rounded-2xl border border-blue-500/20 bg-slate-900/50 text-center space-y-6 relative overflow-hidden">
                  <div className="absolute inset-0 opacity-5" style={{ backgroundImage: "radial-gradient(#3b82f6 1px, transparent 1px)", backgroundSize: "20px 20px" }}></div>
                  
                  <div className="flex justify-center relative">
                    {/* Animated spinning scanner radar */}
                    <div className="relative w-20 h-20">
                      <div className="absolute inset-0 border-4 border-blue-500/10 rounded-full"></div>
                      <div className="absolute inset-0 border-4 border-t-blue-500 rounded-full animate-spin"></div>
                      <div className="absolute inset-3 border border-slate-700/50 rounded-full flex items-center justify-center bg-slate-950">
                        <Loader2 className="h-6 w-6 text-blue-400 animate-pulse" />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-mono font-bold tracking-[0.2em] text-blue-400 uppercase">
                      Neural Core Busy
                    </p>
                    <h3 className="text-sm font-bold text-slate-100 font-display">
                      {loadingStatusText}
                    </h3>
                    <p className="text-[10px] text-slate-500 max-w-xs mx-auto leading-relaxed">
                      AI computer vision model is detecting visual structures, bumper profiles, tail lamps, and manufacturer signatures. Please hold on...
                    </p>
                  </div>
                </div>
              )}

              {/* Step 4: Finished Identification Screen */}
              {scanStep === 'done' && identifiedCar && (
                <div className="space-y-4">
                  {/* Status update alert */}
                  <div className="bg-emerald-500/5 border border-emerald-500/10 p-3 rounded-xl flex items-center justify-between text-[11px] font-mono">
                    <div className="flex items-center gap-2 text-emerald-400">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      <span className="font-bold">Neural Scan Completed</span>
                    </div>
                    <button 
                      onClick={triggerReset}
                      className="text-slate-400 hover:text-white uppercase tracking-wider text-[9px] underline font-semibold cursor-pointer"
                    >
                      New Scan
                    </button>
                  </div>

                  {/* Fully structured automobile report */}
                  <CarDetailsReport
                    car={identifiedCar}
                    onSave={() => saveToGarage(identifiedCar)}
                    onDiscard={triggerReset}
                    isSaved={garage.some(c => c.id === identifiedCar.id)}
                  />
                </div>
              )}

              {/* Step 5: Error Handling Block */}
              {scanStep === 'error' && (
                <div className="p-6 rounded-2xl border border-red-500/20 bg-slate-900/40 text-center space-y-4">
                  <div className="inline-block p-3 bg-red-500/10 text-red-400 rounded-full border border-red-500/20">
                    <ShieldAlert className="h-6 w-6" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-slate-200 uppercase font-display">Target Scan Failed</h3>
                    <p className="text-xs text-slate-400 leading-relaxed max-w-xs mx-auto">
                      {errorMsg || "An unexpected error occurred during frame recognition."}
                    </p>
                  </div>
                  <div className="pt-2">
                    <button
                      onClick={triggerReset}
                      className="w-full bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold py-2.5 rounded-xl transition cursor-pointer"
                    >
                      Retry Protocol
                    </button>
                  </div>
                </div>
              )}

            </div>
          )}

          {/* TAB 2: MY SPOTTER GARAGE */}
          {activeTab === 'garage' && (
            <div className="space-y-5">
              
              {/* Header Title */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <h2 className="text-sm font-black tracking-wider text-slate-100 font-display uppercase">Saved Spotter Garage</h2>
                  <p className="text-[10px] text-slate-500 uppercase font-mono">My personal collection database</p>
                </div>
                <span className="bg-blue-500/10 text-blue-400 border border-blue-500/25 text-[10px] font-mono px-2 py-0.5 rounded-full">
                  {garage.length} Vehicles
                </span>
              </div>

              {/* Select Garage Car or list of saved items */}
              {selectedGarageCar ? (
                <div className="space-y-3">
                  <button
                    onClick={() => setSelectedGarageCar(null)}
                    className="text-xs text-blue-400 hover:text-blue-300 font-bold font-mono uppercase tracking-wider flex items-center gap-1 mb-2 cursor-pointer"
                  >
                    ← Back to Database
                  </button>

                  <CarDetailsReport
                    car={selectedGarageCar}
                    onDiscard={() => setSelectedGarageCar(null)}
                    isSaved={true}
                  />
                </div>
              ) : garage.length === 0 ? (
                /* Empty state */
                <div className="p-8 rounded-2xl border border-slate-850 bg-slate-900/20 text-center space-y-3">
                  <div className="inline-block p-3 bg-slate-900 text-slate-500 rounded-full border border-slate-800">
                    <Database className="h-6 w-6" />
                  </div>
                  <h3 className="text-xs font-bold text-slate-300 uppercase font-display">Database Empty</h3>
                  <p className="text-[11px] text-slate-500 leading-relaxed max-w-xs mx-auto">
                    You have not added any vehicles to your personal garage storage yet. Scan a car and tap "Add to Garage" to persist them.
                  </p>
                  <button
                    onClick={() => setActiveTab('scan')}
                    className="inline-block bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-4 py-2 rounded-xl transition cursor-pointer"
                  >
                    Start Spotting
                  </button>
                </div>
              ) : (
                /* Scans database list style */
                <div className="space-y-3">
                  {garage.map((car) => (
                    <div
                      key={car.id}
                      onClick={() => setSelectedGarageCar(car)}
                      className="p-3 bg-slate-900/50 hover:bg-slate-900 rounded-xl border border-slate-850 hover:border-slate-800 transition flex gap-3 cursor-pointer group"
                    >
                      <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-slate-950 shrink-0 border border-slate-800">
                        <img
                          src={car.image}
                          alt={car.model}
                          className="w-full h-full object-cover"
                        />
                      </div>

                      <div className="flex-1 min-w-0 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between gap-1.5">
                            <span className="text-[9px] uppercase font-mono text-emerald-400 tracking-wider">
                              {car.category}
                            </span>
                            <span className="text-[8px] font-mono text-slate-500">
                              {car.timestamp}
                            </span>
                          </div>
                          <h4 className="text-xs font-bold font-display text-slate-200 uppercase truncate group-hover:text-blue-400 transition-colors">
                            {car.make} {car.model}
                          </h4>
                          <p className="text-[10px] text-slate-400 truncate mt-0.5">
                            Specs: {car.specs.transmission} • {car.specs.driveType}
                          </p>
                        </div>

                        <div className="flex justify-between items-center mt-1">
                          <span className="text-[10px] font-mono font-semibold text-teal-400">
                            {car.estimatedUsedPrice || "Est. Resale N/A"}
                          </span>
                          
                          <button
                            onClick={(e) => removeFromGarage(car.id, e)}
                            className="text-slate-500 hover:text-red-400 transition cursor-pointer p-1"
                            title="Remove from database"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

            </div>
          )}

          {/* TAB 3: SPOTTING GUIDE */}
          {activeTab === 'guide' && (
            <GuideSection />
          )}

        </main>

        {/* FUTURISTIC PREMIUM MOBILE NAVIGATION BAR (Matches High Density styling) */}
        <footer className="mt-auto bg-black/90 backdrop-blur-md border-t border-slate-850 p-3 shrink-0 relative z-20">
          <div className="flex justify-around items-center max-w-sm mx-auto">
            
            {/* Nav item 1 */}
            <button
              onClick={() => { setActiveTab('guide'); setSelectedGarageCar(null); }}
              className={`flex flex-col items-center gap-1 transition-all cursor-pointer ${activeTab === 'guide' ? 'text-blue-500 opacity-100 scale-105' : 'text-slate-500 hover:text-slate-350'}`}
            >
              <div className={`p-1.5 rounded-full border transition-colors ${activeTab === 'guide' ? 'border-blue-500/30 bg-blue-500/10' : 'border-transparent'}`}>
                <Compass className="h-4 w-4" />
              </div>
              <span className="text-[9px] font-mono uppercase tracking-widest font-semibold">Guide</span>
            </button>

            {/* Nav item 2 (Center Big Button) */}
            <button
              onClick={() => { setActiveTab('scan'); setSelectedGarageCar(null); }}
              className={`flex flex-col items-center gap-1 transition-all cursor-pointer -translate-y-2`}
            >
              <div className={`w-12 h-12 rounded-full border-2 transition-all flex items-center justify-center ${
                activeTab === 'scan' 
                  ? 'border-blue-500 bg-blue-500/10 shadow-[0_0_15px_rgba(59,130,246,0.5)]' 
                  : 'border-slate-700 bg-slate-900 group-hover:border-slate-500'
              }`}>
                <CameraIcon className={`h-5 w-5 ${activeTab === 'scan' ? 'text-blue-400' : 'text-slate-400'}`} />
              </div>
              <span className={`text-[9px] font-mono uppercase tracking-widest font-bold -mt-1 ${activeTab === 'scan' ? 'text-blue-400' : 'text-slate-500'}`}>
                Scan
              </span>
            </button>

            {/* Nav item 3 */}
            <button
              onClick={() => { setActiveTab('garage'); setSelectedGarageCar(null); }}
              className={`flex flex-col items-center gap-1 transition-all cursor-pointer ${activeTab === 'garage' ? 'text-blue-500 opacity-100 scale-105' : 'text-slate-500 hover:text-slate-350'}`}
            >
              <div className={`p-1.5 rounded-full border transition-colors ${activeTab === 'garage' ? 'border-blue-500/30 bg-blue-500/10' : 'border-transparent'}`}>
                <Database className="h-4 w-4" />
              </div>
              <span className="text-[9px] font-mono uppercase tracking-widest font-semibold">Garage</span>
            </button>

          </div>
        </footer>

      </div>
    </div>
  );
}
