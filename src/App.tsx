import React, { useState, useEffect, useRef } from "react";
import { 
  Camera as CameraIcon, Upload, Sparkles, History, Compass, Database, 
  Trash2, ShieldAlert, CheckCircle2, ChevronRight, RotateCcw, StopCircle,
  MapPin, Loader2, Gauge, Settings, Cpu, HelpCircle, RefreshCw, Layers, ShieldCheck,
  Search, ArrowUpDown, SlidersHorizontal, Cloud, CloudOff, Server, Copy, Check, ExternalLink, Code,
  LogOut, User, Mail, Lock, Scale, MessageSquare
} from "lucide-react";
import { IdentifiedCar, ScanStepType, getNormalizedCarKey } from "./types";
import SampleCarousel from "./components/SampleCarousel";
import CarDetailsReport from "./components/CarDetailsReport";
import CarComparison from "./components/CarComparison";
import { 
  isSupabaseConfigured, 
  fetchSupabaseGarage, 
  saveSupabaseCar, 
  removeSupabaseCar, 
  syncLocalGarageToCloud,
  getActiveSupabaseConfig,
  updateSupabaseConfig,
  sendOtpCode,
  verifyOtpCode,
  signInWithSocial,
  signOutUser,
  supabase
} from "./lib/supabase";

export interface AppTheme {
  id: string;
  name: string;
  brand: string;
  colorHex: string;
  primaryBg: string; // Tailwind class
  cardBg: string; // Tailwind class
  primaryText: string; // Tailwind class
  accentText: string; // Tailwind class
  accentBg: string; // Tailwind class
  accentBorder: string; // Tailwind class
  accentHover: string; // Tailwind class
  pulseBg: string; // Tailwind class
  glowClass: string; // Tailwind class
  accentHoverBg: string; // Tailwind class
  loaderText: string; // Tailwind class
}

export const THEMES: Record<string, AppTheme> = {
  bugatti: {
    id: "bugatti",
    name: "Monaco Blue",
    brand: "Bugatti Chiron",
    colorHex: "#3b82f6",
    primaryBg: "bg-[#090b10]",
    cardBg: "bg-[#10131b]",
    primaryText: "text-blue-400",
    accentText: "text-blue-500",
    accentBg: "bg-blue-600",
    accentBorder: "border-blue-500/30",
    accentHover: "hover:bg-blue-500",
    pulseBg: "bg-blue-500",
    glowClass: "shadow-blue-900/10",
    accentHoverBg: "hover:bg-blue-500",
    loaderText: "text-blue-400"
  },
  ferrari: {
    id: "ferrari",
    name: "Scuderia Red",
    brand: "Ferrari SF90",
    colorHex: "#ef4444",
    primaryBg: "bg-[#0e0707]",
    cardBg: "bg-[#180f0f]",
    primaryText: "text-red-400",
    accentText: "text-red-500",
    accentBg: "bg-red-600",
    accentBorder: "border-red-500/30",
    accentHover: "hover:bg-red-500",
    pulseBg: "bg-red-500",
    glowClass: "shadow-red-900/10",
    accentHoverBg: "hover:bg-red-500",
    loaderText: "text-red-400"
  },
  porsche: {
    id: "porsche",
    name: "Acid Lime",
    brand: "911 GT3 RS",
    colorHex: "#84cc16",
    primaryBg: "bg-[#060a07]",
    cardBg: "bg-[#0f1811]",
    primaryText: "text-lime-400",
    accentText: "text-lime-500",
    accentBg: "bg-lime-500 text-black",
    accentBorder: "border-lime-500/30",
    accentHover: "hover:bg-lime-400",
    pulseBg: "bg-lime-450",
    glowClass: "shadow-lime-900/10",
    accentHoverBg: "hover:bg-lime-400",
    loaderText: "text-lime-400"
  },
  mclaren: {
    id: "mclaren",
    name: "Papaya Carbon",
    brand: "McLaren Artura",
    colorHex: "#f97316",
    primaryBg: "bg-[#0e0a07]",
    cardBg: "bg-[#1c130d]",
    primaryText: "text-orange-400",
    accentText: "text-orange-500",
    accentBg: "bg-orange-600",
    accentBorder: "border-orange-500/30",
    accentHover: "hover:bg-orange-500",
    pulseBg: "bg-orange-500",
    glowClass: "shadow-orange-900/10",
    accentHoverBg: "hover:bg-orange-500",
    loaderText: "text-orange-400"
  },
  lamborghini: {
    id: "lamborghini",
    name: "Amethyst SVJ",
    brand: "Aventador SVJ",
    colorHex: "#d946ef",
    primaryBg: "bg-[#0a050f]",
    cardBg: "bg-[#160b24]",
    primaryText: "text-fuchsia-400",
    accentText: "text-fuchsia-500",
    accentBg: "bg-fuchsia-600",
    accentBorder: "border-fuchsia-500/30",
    accentHover: "hover:bg-fuchsia-500",
    pulseBg: "bg-fuchsia-500",
    glowClass: "shadow-fuchsia-900/10",
    accentHoverBg: "hover:bg-fuchsia-500",
    loaderText: "text-fuchsia-450"
  }
};

const HOTSPOTS = [
  { name: "Daikoku Parking Area, Yokohama", coords: "35.4612° N, 139.6714° E" },
  { name: "Nürburgring Boulevard, Germany", coords: "50.3341° N, 6.9427° E" },
  { name: "Casino Square, Monaco", coords: "43.7391° N, 7.4273° E" },
  { name: "Beverly Hills, California", coords: "34.0736° N, 118.4004° W" },
  { name: "Yas Marina Circuit, Abu Dhabi", coords: "24.4672° N, 54.6067° E" }
];

export function getGarageStorageKey(user: any): string {
  if (user && user.id) {
    return `car_spotter_garage_v2_${user.id}`;
  }
  return "car_spotter_garage_v2_guest";
}

export default function App() {
  // Mobile UI Tabs: 'scan' | 'garage' | 'account'
  const [activeTab, setActiveTab] = useState<'scan' | 'garage' | 'account'>('scan');

  // Sport tuning dashboard state
  const [currThemeId, setCurrThemeId] = useState<string>(() => {
    return localStorage.getItem("whipcheck_theme_id") || "bugatti";
  });

  useEffect(() => {
    localStorage.setItem("whipcheck_theme_id", currThemeId);
  }, [currThemeId]);

  const activeTheme = THEMES[currThemeId] || THEMES.bugatti;
  
  // Scans history & collection garage
  const [garage, setGarage] = useState<IdentifiedCar[]>([]);
  const [selectedGarageCar, setSelectedGarageCar] = useState<IdentifiedCar | null>(null);

  // Real-time backend comments meta synchronization for garage items
  const [garageCommentsMeta, setGarageCommentsMeta] = useState<Record<string, { count: number; lastId: string }>>({});

  useEffect(() => {
    let active = true;
    const fetchAllGarageComments = async () => {
      if (garage.length === 0) return;
      
      const uniqueKeys: string[] = Array.from(new Set(garage.map(getNormalizedCarKey)));
      const newMeta: Record<string, { count: number; lastId: string }> = {};

      await Promise.all(
        uniqueKeys.map(async (key) => {
          try {
            if (isSupabaseConfigured() && supabase) {
              const { data, error } = await supabase
                .from("comments")
                .select("*")
                .eq("car_id", key)
                .order("created_at", { ascending: true });
              
              if (!error && data) {
                if (data.length > 0) {
                  newMeta[key] = {
                    count: data.length,
                    lastId: data[data.length - 1].id
                  };
                } else {
                  newMeta[key] = { count: 0, lastId: "" };
                }
              }
            } else {
              const res = await fetch(`/api/comments/${key}`);
              if (res.ok) {
                const data = await res.json();
                const list = data.comments || [];
                if (list.length > 0) {
                  newMeta[key] = {
                    count: list.length,
                    lastId: list[list.length - 1].id
                  };
                } else {
                  newMeta[key] = { count: 0, lastId: "" };
                }
              }
            }
          } catch (e) {
            console.warn("Failed to retrieve comments metadata for", key, e);
          }
        })
      );

      if (active) {
        setGarageCommentsMeta(newMeta);
      }
    };

    fetchAllGarageComments();

    // Poll every 6 seconds to capture live comments added by other users
    const interval = setInterval(() => {
      fetchAllGarageComments();
    }, 6000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [garage, activeTab]);

  // Custom vehicle comparison module states
  const [compareList, setCompareList] = useState<IdentifiedCar[]>([]);
  const [showCompareActive, setShowCompareActive] = useState<boolean>(false);
  const [compareError, setCompareError] = useState<string | null>(null);
  
  const handleToggleCompare = (car: IdentifiedCar, e: React.MouseEvent) => {
    e.stopPropagation();
    setCompareList((prev) => {
      const exists = prev.some((c) => c.id === car.id);
      if (exists) {
        return prev.filter((c) => c.id !== car.id);
      } else {
        if (prev.length >= 3) {
          setCompareError("Maximum of 3 vehicles can be compared at once.");
          setTimeout(() => setCompareError(null), 3500);
          return prev;
        }
        return [...prev, car];
      }
    });
  };

  // Garage sorting, grouping, and search states
  const [garageSearch, setGarageSearch] = useState<string>("");
  const [garageSortBy, setGarageSortBy] = useState<string>("newest"); // "newest", "brand", "year", "confidence"
  const [garageGroupBy, setGarageGroupBy] = useState<string>("none"); // "none", "brand", "category", "color"
  const [apiKeyConfigured, setApiKeyConfigured] = useState<boolean | null>(null);

  // Supabase Sync & Authenticative States
  const [isSupabaseSyncing, setIsSupabaseSyncing] = useState<boolean>(false);
  const [supabaseStatus, setSupabaseStatus] = useState<'idle' | 'synced' | 'error'>('idle');
  const [supabaseError, setSupabaseError] = useState<string | null>(null);
  const [copiedSql, setCopiedSql] = useState<boolean>(false);
  const [sqlSchemaMode, setSqlSchemaMode] = useState<'create' | 'upgrade'>('create');
  const [syncProgress, setSyncProgress] = useState<string | null>(null);
  const [resetFeedback, setResetFeedback] = useState<string | null>(() => {
    const saved = sessionStorage.getItem("whipcheck_wiped_success_msg");
    if (saved) {
      sessionStorage.removeItem("whipcheck_wiped_success_msg");
    }
    return saved || null;
  });
  const [showWipeConfirm, setShowWipeConfirm] = useState<boolean>(false);
  const [accountSyncProgress, setAccountSyncProgress] = useState<string | null>(null);
  const [accountSyncError, setAccountSyncError] = useState<string | null>(null);

  // User Authentication hook parameters
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [authEmail, setAuthEmail] = useState<string>(() => localStorage.getItem("whipcheck_auth_email") || "");
  const [authOtpCode, setAuthOtpCode] = useState<string>("");
  const [authStep, setAuthStep] = useState<'idle' | 'otp_sent'>('idle');
  const [authLoading, setAuthLoading] = useState<boolean>(false);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [authErrorInput, setAuthErrorInput] = useState<string | null>(null);

  // Custom Account Credentials States
  const [authFormMode, setAuthFormMode] = useState<'signin' | 'signup' | 'otp_verify'>('signin');
  const [authUsername, setAuthUsername] = useState<string>("");
  const [authPassword, setAuthPassword] = useState<string>("");
  const [authConfirmPassword, setAuthConfirmPassword] = useState<string>("");
  const [devOtpCode, setDevOtpCode] = useState<string>("");

  // Admin Gateway and Live Parameters States
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState<boolean>(() => {
    return sessionStorage.getItem("whipcheck_admin_session") === "true";
  });
  const [adminPasswordInput, setAdminPasswordInput] = useState<string>("");
  const [adminError, setAdminError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [customSupabaseUrl, setCustomSupabaseUrl] = useState<string>(() => getActiveSupabaseConfig().url);
  const [customSupabaseAnonKey, setCustomSupabaseAnonKey] = useState<string>(() => getActiveSupabaseConfig().anonKey);
  const [paramFeedback, setParamFeedback] = useState<string | null>(null);
  // Scan workflow state
  const [scanStep, setScanStep] = useState<ScanStepType>('idle');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [identifiedCar, setIdentifiedCar] = useState<IdentifiedCar | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loadingStatusText, setLoadingStatusText] = useState<string>("Initializing...");
  const [urlInput, setUrlInput] = useState<string>("");
  const [isInIframe, setIsInIframe] = useState<boolean>(false);

  // Camera references
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const scanAbortControllerRef = useRef<AbortController | null>(null);

  // Simulated GPS or Real Geolocation
  const [gpsCoords, setGpsCoords] = useState(HOTSPOTS[0].coords);
  const [gpsName, setGpsName] = useState(HOTSPOTS[0].name);

  // Initialize and load saved garage items (Unified local + Supabase)
  useEffect(() => {
    // Detect if inside an iframe
    try {
      setIsInIframe(window.self !== window.top);
    } catch (e) {
      setIsInIframe(true);
    }

    // Check backend API health and key configuration
    fetch("/api/health")
      .then((res) => res.json())
      .then((data) => {
        if (data && typeof data.apiKeyConfigured === "boolean") {
          setApiKeyConfigured(data.apiKeyConfigured);
        }
      })
      .catch((err) => {
        console.error("Failed to fetch backend health status:", err);
      });

    // Ensure default guest spotter alias is initialized
    if (!localStorage.getItem("whipcheck_spotter_name")) {
      localStorage.setItem("whipcheck_spotter_name", "Guest");
    }

    // Load custom credentials user session first to get context
    let parsedUser: any = null;
    const savedUser = localStorage.getItem("whipcheck_user_session");
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        if (parsed && parsed.id) {
          parsedUser = parsed;
        }
      } catch (e) {}
    }

    // Determine secure initial namespaced Storage key
    let initialKey = getGarageStorageKey(parsedUser);

    // If there's a Supabase token locally before user state resolution, try resolving its ID
    if (!parsedUser) {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith("sb-") && k.endsWith("-auth-token")) {
          try {
            const tokenData = JSON.parse(localStorage.getItem(k) || "{}");
            if (tokenData?.user?.id) {
              initialKey = getGarageStorageKey(tokenData.user);
            }
          } catch (e) {}
        }
      }
    }

    // Load local storage items first for immediate UI paint
    let localCars: IdentifiedCar[] = [];
    try {
      const saved = localStorage.getItem(initialKey) || localStorage.getItem("car_spotter_garage_v2");
      if (saved) {
        localCars = JSON.parse(saved);
        setGarage(localCars);
        // Automatic backward migration to prevent dirty states
        if (!localStorage.getItem(initialKey) && localStorage.getItem("car_spotter_garage_v2")) {
          localStorage.setItem(initialKey, saved);
          localStorage.removeItem("car_spotter_garage_v2");
        }
      }
    } catch (e) {
      console.error("Failed to load local garage items", e);
    }

    if (parsedUser) {
      setCurrentUser(parsedUser);
      // Trigger custom garage sync
      fetch(`/api/user/vehicles/${parsedUser.id}`)
        .then(res => res.json())
        .then(data => {
          if (data && data.vehicles) {
            setGarage(data.vehicles);
            localStorage.setItem(getGarageStorageKey(parsedUser), JSON.stringify(data.vehicles));
            // Invalidate/clear guest local garage
            localStorage.removeItem("car_spotter_garage_v2_guest");
            localStorage.removeItem("car_spotter_garage_v2");
            setSupabaseStatus("synced");
          }
        })
        .catch(err => {
          console.warn("Failed to complete custom user garage sync on boot", err);
        });
    }

    // Cloud sync is handled reactively by the authentication session listener below

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

  // Real Dynamic Sharing deep-link listener
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const sharedCarData = params.get("share_car");
      const sharedCompareData = params.get("share_compare");

      if (sharedCarData) {
        const decodedCar = JSON.parse(decodeURIComponent(escape(atob(sharedCarData))));
        if (decodedCar && decodedCar.id) {
          setIdentifiedCar(decodedCar);
          setScanStep('done');
          setActiveTab('scan');
          // Clean query params cleanly
          const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
          window.history.replaceState({ path: cleanUrl }, '', cleanUrl);
        }
      } else if (sharedCompareData) {
        const decodedCars = JSON.parse(decodeURIComponent(escape(atob(sharedCompareData))));
        if (Array.isArray(decodedCars) && decodedCars.length > 0) {
          setCompareList(decodedCars);
          setShowCompareActive(true);
          setActiveTab('garage');
          // Clean query params cleanly
          const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
          window.history.replaceState({ path: cleanUrl }, '', cleanUrl);
        }
      }
    } catch (e) {
      console.error("Failed to parse shared query payload", e);
    }
  }, []);

  // Reactive Listener for Supabase Auth State Changes and Scoped syncs
  useEffect(() => {
    if (!isSupabaseConfigured() || !supabase) return;
    
    // Check initial user session info
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUser(user);
      if (user) {
        syncUserGarage(user);
      }
    }).catch(err => {
      console.warn("Initial getUser failed:", err);
    });

    // Detect and handle magic-link redirects (PKCE or Hash confirmation URL token hashes)
    const handleAuthRedirects = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const tokenHash = params.get("token_hash");
      const type = (params.get("type") as any) || "signup";

      if ((code || tokenHash) && supabase) {
        setAuthLoading(true);
        setAuthMessage("Configuring secure cloud session from confirmation email...");
        try {
          let result;
          if (code) {
            result = await supabase.auth.exchangeCodeForSession(code);
          } else if (tokenHash) {
            result = await supabase.auth.verifyOtp({ token_hash: tokenHash, type, options: { redirectTo: window.location.origin } });
          }

          if (result?.error) {
            setAuthErrorInput(`Authentication failed: ${result.error.message}`);
          } else if (result?.data?.user) {
            setAuthMessage("Successfully signed in via email link authentication!");
            const authUser = result.data.user;
            setCurrentUser(authUser);
            syncUserGarage(authUser);
          }
        } catch (err: any) {
          console.error("Auth redirect error:", err);
          setAuthErrorInput(`Handling error: ${err.message || String(err)}`);
        } finally {
          setAuthLoading(false);
          // Clear URL query parameters cleanly
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      }
    };
    handleAuthRedirects();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      const user = session?.user || null;
      
      // Prevent Supabase's empty auth state from overriding an existing custom user session
      const hasCustomSession = !!localStorage.getItem("whipcheck_user_session");
      if (hasCustomSession) {
        return;
      }

      setCurrentUser(user);
      if (user) {
        syncUserGarage(user);
      } else {
        // Fallback to offline / anonymous state
        const saved = localStorage.getItem("car_spotter_garage_v2_guest");
        if (saved) {
          try {
            setGarage(JSON.parse(saved));
          } catch(e) {
            setGarage([]);
          }
        } else {
          setGarage([]);
        }
        setSupabaseStatus("idle");
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  const syncUserGarage = async (user: any) => {
    if (!user) return;
    try {
      setIsSupabaseSyncing(true);
      const cloudCars = await fetchSupabaseGarage(user.id);
      
      let localCars: IdentifiedCar[] = [];
      const savedStr = localStorage.getItem("car_spotter_garage_v2_guest");
      if (savedStr) {
        try {
          localCars = JSON.parse(savedStr);
        } catch (e) {
          console.error(e);
        }
      }
      
      const cloudMap = new Map(cloudCars.map(c => [c.id, c]));
      const cloudNormalizedKeys = new Set(cloudCars.map(getNormalizedCarKey));
      
      // Determine unique local cars that do not exist yet in the cloud garage (checked via normalized keys to prevent duplicates)
      const unsyncedLocal = localCars.filter(lc => {
        const key = getNormalizedCarKey(lc);
        if (key) {
          return !cloudNormalizedKeys.has(key);
        }
        return !cloudMap.has(lc.id);
      });

      if (unsyncedLocal.length > 0) {
        await syncLocalGarageToCloud(unsyncedLocal);
      }

      // Sync and migrate all local guest ratings & comments to Supabase
      const localCommentsList: any[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith("car_comments_")) {
          const carId = k.replace("car_comments_", "");
          try {
            const commentsData = JSON.parse(localStorage.getItem(k) || "[]");
            if (Array.isArray(commentsData)) {
              commentsData.forEach((cmt: any) => {
                localCommentsList.push({ ...cmt, carId });
              });
            }
          } catch (pe) {
            console.warn("Local comments parse failure:", pe);
          }
        }
      }

      if (localCommentsList.length > 0) {
        const formattedComments = localCommentsList.map(c => ({
          id: c.id,
          car_id: c.carId || c.car_id || "unknown",
          author: c.author || (user ? user.username || user.email : "Anonymous"),
          text: c.text || "",
          timestamp: c.timestamp || new Date().toLocaleString(),
          comfort: typeof c.comfort === 'number' ? c.comfort : null,
          gasConsumption: typeof c.gasConsumption === 'number' ? c.gasConsumption : (typeof c.gas_consumption === 'number' ? c.gas_consumption : null),
          performance: typeof c.performance === 'number' ? c.performance : null,
          reliability: typeof c.reliability === 'number' ? c.reliability : null
        }));

        await supabase
          .from("comments")
          .upsert(formattedComments, { onConflict: "id" });
      }

      // Reload fresh garage view from Supabase
      const freshCars = await fetchSupabaseGarage(user.id);
      setGarage(freshCars);
      localStorage.setItem(`car_spotter_garage_v2_${user.id}`, JSON.stringify(freshCars));

      // Clear out guest garage so fallback doesn't mix future sessions
      localStorage.removeItem("car_spotter_garage_v2_guest");
      localStorage.removeItem("car_spotter_garage_v2");

      setSupabaseStatus("synced");
      setSupabaseError(null);
    } catch (err: any) {
      console.error("Supabase failed user sync:", err);
      setSupabaseStatus("error");
      setSupabaseError(err.message || String(err));
    } finally {
      setIsSupabaseSyncing(false);
    }
  };

  // Sync garage with localstorage and cloud
  const saveToGarage = async (car: IdentifiedCar) => {
    if (!car) return;
    const key = getGarageStorageKey(currentUser);
    const exists = garage.some(c => c.id === car.id);
    if (!exists) {
      const updated = [car, ...garage];
      setGarage(updated);
      localStorage.setItem(key, JSON.stringify(updated));

      // Synchronize to the custom user server if available
      if (currentUser && currentUser.id && localStorage.getItem("whipcheck_user_session")) {
        try {
          setIsSupabaseSyncing(true);
          await fetch(`/api/user/vehicles/${currentUser.id}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ vehicle: car })
          });
          setSupabaseStatus("synced");
        } catch (err) {
          console.error("Live Cust Auth Save Failed:", err);
        } finally {
          setIsSupabaseSyncing(false);
        }
      }

      // Synchronize in the cloud synchronously if credentials set (backward compatibility - registered users only)
      if (currentUser && isSupabaseConfigured()) {
        try {
          setIsSupabaseSyncing(true);
          await saveSupabaseCar(car);
          setSupabaseStatus("synced");
        } catch (err: any) {
          console.error("Live Cloud Sync Failed:", err);
          setSupabaseStatus("error");
          setSupabaseError(`Save failed: ${err.message || err}`);
        } finally {
          setIsSupabaseSyncing(false);
        }
      }
    }
  };

  const removeFromGarage = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    
    const carToDelete = garage.find(c => c.id === id);
    if (carToDelete) {
      const normalizedKey = getNormalizedCarKey(carToDelete);
      
      // Determine the active author name of this session
      let currentAuthor = "Guest";
      const savedUser = localStorage.getItem("whipcheck_user_session");
      if (savedUser) {
        try {
          const parsed = JSON.parse(savedUser);
          currentAuthor = parsed.username || parsed.email || parsed.id || "Guest";
        } catch (err) {}
      } else {
        currentAuthor = localStorage.getItem("whipcheck_spotter_name") || "Guest";
      }

      // 1. Delete/filter comments & ratings from localStorage for this user only
      [normalizedKey, id].forEach(keyVal => {
        if (!keyVal) return;
        const k = `car_comments_${keyVal}`;
        const saved = localStorage.getItem(k);
        if (saved) {
          try {
            const commentsList = JSON.parse(saved);
            if (Array.isArray(commentsList)) {
              // Delete comments/ratings authored by the current user sequence only
              const filtered = commentsList.filter((c: any) => c.author !== currentAuthor);
              if (filtered.length > 0) {
                localStorage.setItem(k, JSON.stringify(filtered));
              } else {
                localStorage.removeItem(k);
              }
            }
          } catch (pe) {
            localStorage.removeItem(k);
          }
        }
      });

      // 2. Only registered/logged-in users update remote backend servers
      if (currentUser) {
        // Delete comments & ratings from Node server database
        try {
          await fetch(`/api/comments/${normalizedKey}?author=${encodeURIComponent(currentAuthor)}`, { method: "DELETE" });
        } catch (err) {
          console.error("Failed to delete local comments by key:", normalizedKey, err);
        }
        if (id !== normalizedKey) {
          try {
            await fetch(`/api/comments/${id}?author=${encodeURIComponent(currentAuthor)}`, { method: "DELETE" });
          } catch (err) {
            console.error("Failed to delete local comments by ID:", id, err);
          }
        }

        // Delete comments & ratings from Supabase DB
        if (isSupabaseConfigured() && supabase) {
          try {
            if (normalizedKey) {
              await supabase.from("comments").delete().eq("car_id", normalizedKey).eq("author", currentAuthor);
            }
            await supabase.from("comments").delete().eq("car_id", id).eq("author", currentAuthor);
          } catch (err) {
            console.error("Failed to delete comments from Supabase database:", err);
          }
        }
      }
    }

    const updated = garage.filter(c => c.id !== id);
    setGarage(updated);
    setCompareList(prev => prev.filter(c => c.id !== id));
    localStorage.setItem(getGarageStorageKey(currentUser), JSON.stringify(updated));
    if (selectedGarageCar && selectedGarageCar.id === id) {
      setSelectedGarageCar(null);
    }

    // Synchronize to custom user server if available
    if (currentUser && currentUser.id && localStorage.getItem("whipcheck_user_session")) {
      try {
        setIsSupabaseSyncing(true);
        await fetch(`/api/user/vehicles/${currentUser.id}/${id}`, {
          method: "DELETE"
        });
        setSupabaseStatus("synced");
      } catch (err) {
        console.error("Live Cust Auth Remove Failed:", err);
      } finally {
        setIsSupabaseSyncing(false);
      }
    }

    if (currentUser && isSupabaseConfigured()) {
      try {
        setIsSupabaseSyncing(true);
        await removeSupabaseCar(id);
        setSupabaseStatus("synced");
      } catch (err: any) {
        console.error("Live Cloud Removal Failed:", err);
        setSupabaseStatus("error");
        setSupabaseError(`Delete failed: ${err.message || err}`);
      } finally {
        setIsSupabaseSyncing(false);
      }
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

    const controller = new AbortController();
    scanAbortControllerRef.current = controller;

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
        signal: controller.signal,
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
      if (err.name === 'AbortError') {
        console.log("Image scan successfully aborted by user.");
        return;
      }
      console.error(err);
      setErrorMsg(err.message || "Communication protocol failed during neural vision scan.");
      setScanStep('error');
    } finally {
      if (scanAbortControllerRef.current === controller) {
        scanAbortControllerRef.current = null;
      }
    }
  };

  const handleStopScan = () => {
    if (scanAbortControllerRef.current) {
      scanAbortControllerRef.current.abort();
      scanAbortControllerRef.current = null;
    }
    triggerReset();
  };

  const triggerReset = () => {
    setImageUrl(null);
    setIdentifiedCar(null);
    setErrorMsg(null);
    setScanStep('idle');
    setUrlInput("");
    stopCamera();
  };

  // Filter, sort and group the garage items
  const filteredGarage = garage.filter((car) => {
    if (!garageSearch.trim()) return true;
    const query = garageSearch.toLowerCase();
    const makeVal = car.make || "";
    const modelVal = car.model || "";
    const catVal = car.category || "";
    const colorVal = car.color || "";
    const transVal = car.specs?.transmission || "";
    const dtVal = car.specs?.driveType || "";
    const extYearVal = car.modelYear || "";
    return (
      makeVal.toLowerCase().includes(query) ||
      modelVal.toLowerCase().includes(query) ||
      catVal.toLowerCase().includes(query) ||
      colorVal.toLowerCase().includes(query) ||
      transVal.toLowerCase().includes(query) ||
      dtVal.toLowerCase().includes(query) ||
      extYearVal.toLowerCase().includes(query)
    );
  });

  const sortedGarage = [...filteredGarage].sort((a, b) => {
    if (garageSortBy === "brand") {
      const aName = `${a.make || ""} ${a.model || ""}`.toLowerCase();
      const bName = `${b.make || ""} ${b.model || ""}`.toLowerCase();
      return aName.localeCompare(bName);
    } else if (garageSortBy === "year") {
      const aYr = parseInt(a.modelYear) || 0;
      const bYr = parseInt(b.modelYear) || 0;
      return bYr - aYr; // Newest year first
    } else if (garageSortBy === "confidence") {
      const aConf = a.confidence || 0;
      const bConf = b.confidence || 0;
      return bConf - aConf; // Highest confidence first
    } else {
      // "newest" by timestamp
      const aTime = new Date(a.timestamp).getTime() || 0;
      const bTime = new Date(b.timestamp).getTime() || 0;
      return bTime - aTime;
    }
  });

  // Create groups if necessary
  interface GroupedCars {
    groupTitle: string;
    cars: IdentifiedCar[];
  }

  let groupedGarage: GroupedCars[] = [];

  if (garageGroupBy === "none") {
    groupedGarage = [{ groupTitle: "", cars: sortedGarage }];
  } else {
    const groupsMap: Record<string, IdentifiedCar[]> = {};
    sortedGarage.forEach((car) => {
      let key = "Other";
      if (garageGroupBy === "brand") {
        key = car.make || "Unknown Brand";
      } else if (garageGroupBy === "category") {
        key = car.category || "Uncategorized";
      } else if (garageGroupBy === "color") {
        key = car.color || "Other Color";
      }
      
      key = key.trim();
      if (key) {
        key = key.charAt(0).toUpperCase() + key.slice(1);
      } else {
        key = "Unknown";
      }
      
      if (!groupsMap[key]) {
        groupsMap[key] = [];
      }
      groupsMap[key].push(car);
    });

    groupedGarage = Object.keys(groupsMap)
      .sort((a, b) => a.localeCompare(b))
      .map((key) => ({
        groupTitle: key,
        cars: groupsMap[key],
      }));
  }

  const handleCopySql = () => {
    const fullSchema = `-- Create WhipCheck saved vehicles table on Supabase
create table public.vehicles (
  id text primary key,
  timestamp text not null,
  image text not null,
  "isCar" boolean default true,
  make text,
  model text,
  generation text,
  "yearRange" text,
  confidence numeric,
  color text,
  category text,
  "engineType" text,
  power text,
  horsepower text,
  torque text,
  "modelYear" text,
  "zeroToSixty" text,
  "estimatedNewPrice" text,
  "estimatedUsedPrice" text,
  trivia jsonb,
  tips jsonb,
  specs jsonb,
  user_id text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security (RLS) for vehicles
alter table public.vehicles enable row level security;

-- Create policy to allow public access to vehicles
create policy "Allow public access to vehicles" 
  on public.vehicles 
  for all 
  using (true) 
  with check (true);

-- Create comments table on Supabase
create table public.comments (
  id text primary key,
  car_id text not null,
  author text not null,
  text text not null,
  timestamp text,
  comfort integer,
  "gasConsumption" integer,
  performance integer,
  reliability integer,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security (RLS) for comments
alter table public.comments enable row level security;

-- Create policy to allow public access to comments
create policy "Allow public access to comments"
  on public.comments
  for all
  using (true)
  with check (true);`;

    const upgradeSchema = `-- Upgrade existing tables to match the latest application schema
-- Adds the missing user_id column to direct scans link mapping to Supabase securely

-- 1. Alter the vehicles table to add the user_id mapping column
alter table public.vehicles add column if not exists user_id text;

-- 2. Verify and enforce RLS (Row Level Security) fallback defaults helper
alter table public.vehicles enable row level security;

-- 3. Ensure public access comments table and policy are safe
alter table public.comments enable row level security;

-- Notification
-- Run this in your Supabase SQL Editor, then retry direct account sync!`;

    const txt = sqlSchemaMode === 'create' ? fullSchema : upgradeSchema;

    navigator.clipboard.writeText(txt).then(() => {
      setCopiedSql(true);
      setTimeout(() => setCopiedSql(false), 3000);
    });
  };

  const handleManualSync = async () => {
    if (!isSupabaseConfigured()) {
      return;
    }
    if (garage.length === 0) {
      setSyncProgress("No vehicles to sync. Capture or scan some cars first!");
      return;
    }

    try {
      setSyncProgress("Initiating sync of local storage cars to cloud database...");
      setIsSupabaseSyncing(true);
      const res = await syncLocalGarageToCloud(garage, currentUser?.id);
      
      if (res.errors.length > 0) {
        setSyncProgress(`Partially completed: Sync success for ${res.successCount} vehicles. ${res.errors.length} failed. Check console.`);
      } else {
        setSyncProgress(`Successfully synchronized ${res.successCount} vehicles to your live Supabase database!`);
        // Refresh local items
        const fresh = await fetchSupabaseGarage(currentUser?.id);
        setGarage(fresh);
        localStorage.setItem(getGarageStorageKey(currentUser), JSON.stringify(fresh));
        setSupabaseStatus("synced");
      }
    } catch (e: any) {
      setSyncProgress(`Sync failed: ${e.message || e}`);
      setSupabaseStatus("error");
    } finally {
      setIsSupabaseSyncing(false);
    }
  };

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedInput = adminPasswordInput.trim();
    if (normalizedInput === "admin" || normalizedInput === "admin123") {
      setIsAdminLoggedIn(true);
      sessionStorage.setItem("whipcheck_admin_session", "true");
      setAdminError(null);
      
      const active = getActiveSupabaseConfig();
      setCustomSupabaseUrl(active.url);
      setCustomSupabaseAnonKey(active.anonKey);
    } else {
      setAdminError("Invalid administrator credentials. Access denied.");
    }
  };

  const handleAdminLogout = () => {
    setIsAdminLoggedIn(false);
    sessionStorage.removeItem("whipcheck_admin_session");
    setAdminPasswordInput("");
  };

  const handleSaveParameters = () => {
    try {
      updateSupabaseConfig(customSupabaseUrl, customSupabaseAnonKey);
      setParamFeedback("Live integration parameters applied successfully! Reconnected.");
      setTimeout(() => setParamFeedback(null), 4000);
      
      if (isSupabaseConfigured()) {
        setSupabaseStatus("idle");
        fetchSupabaseGarage(currentUser?.id)
          .then((cloudCars) => {
            setGarage(cloudCars);
            localStorage.setItem(getGarageStorageKey(currentUser), JSON.stringify(cloudCars));
            setSupabaseStatus("synced");
          })
          .catch((err) => {
            console.error(err);
            setSupabaseStatus("error");
            setSupabaseError(err.message || String(err));
          });
      }
    } catch (e: any) {
      setParamFeedback(`Configuration error: ${e.message || e}`);
      setTimeout(() => setParamFeedback(null), 4000);
    }
  };

  const handleResetParameters = () => {
    localStorage.removeItem("whipcheck_supabase_url");
    localStorage.removeItem("whipcheck_supabase_anon_key");
    updateSupabaseConfig("", ""); 
    
    const active = getActiveSupabaseConfig();
    setCustomSupabaseUrl(active.url);
    setCustomSupabaseAnonKey(active.anonKey);
    
    setParamFeedback("Parameters reset to compiler environment variables.");
    setTimeout(() => setParamFeedback(null), 4000);
  };

  const handleHardResetServerDatabases = async () => {
    try {
      setResetFeedback("Purging database files on server and cloud...");
      
      // 1. Clean up user-related records in Supabase Cloud database & invalidate session if active
      if (isSupabaseConfigured() && supabase) {
        try {
          // Retrieve current user first to fetch and wipe their matching cloud rows
          const { data: { user } } = await supabase.auth.getUser();
          
          if (user) {
            // Delete user's comments/ratings if matching their author/spotter identity
            const authorName = localStorage.getItem("whipcheck_spotter_name") || user.email;
            if (authorName) {
              await supabase.from("comments").delete().eq("author", authorName);
            }
            
            // Delete user's vehicles listed under their user_id
            await supabase.from("vehicles").delete().eq("user_id", user.id);
            
            // Fetch the user's vehicles and delete them by ID explicitly (bypasses RLS field differences)
            try {
              const activeCars = await fetchSupabaseGarage(user.id);
              if (activeCars && activeCars.length > 0) {
                for (const car of activeCars) {
                  await supabase.from("vehicles").delete().eq("id", car.id);
                  await supabase.from("comments").delete().eq("car_id", car.id);
                  const normKey = getNormalizedCarKey(car);
                  if (normKey && normKey !== car.id) {
                    await supabase.from("comments").delete().eq("car_id", normKey);
                  }
                }
              }
            } catch (carErr) {
              console.warn("Individual vehicle cloud cleanup failed:", carErr);
            }
          }
          
          // Broad delete attempt across vehicles and comments (clears all public rows allowed by policies)
          try {
            await supabase.from("vehicles").delete().neq("id", "0");
          } catch (e) {}
          try {
            await supabase.from("comments").delete().neq("id", "0");
          } catch (e) {}
          
          await supabase.auth.signOut();
        } catch (authErr) {
          console.warn("Supabase Auth-level wipe failed:", authErr);
        }
      }

      const res = await fetch("/api/admin/reset-database", { method: "POST" });
      if (res.ok) {
        setResetFeedback("Reset success. Flushing active browser cookies, comments caches & metadata...");
        
        // 2. Clear all localStorage keys comprehensively using stable Object.keys()
        const keys = Object.keys(localStorage);
        keys.forEach(key => {
          if (key !== "whipcheck_supabase_url" && key !== "whipcheck_supabase_anon_key") {
            localStorage.removeItem(key);
          }
        });

        // 3. Purge sessionStorage completely
        sessionStorage.clear();
        
        // 4. Store a reload-safe message in sessionStorage so it displays after refresh
        sessionStorage.setItem(
          "whipcheck_wiped_success_msg",
          "✅ SUCCESS: All server-side databases (users, scanned cars, comments, ratings) and local browser cached review comments have been cleared successfully!"
        );

        // 5. Hard reload to root to completely purge deep-context React states and cache buffers
        window.location.href = "/";
      } else {
        const errData = await res.json().catch(() => ({ error: "Reset failed" }));
        setResetFeedback(`Error: ${errData.error || "Reset failed"}`);
      }
    } catch (err: any) {
      setResetFeedback(`Request failed: ${err.message || err}`);
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authEmail.trim()) {
      setAuthErrorInput("Please enter a valid email address.");
      return;
    }
    setAuthLoading(true);
    setAuthErrorInput(null);
    setAuthMessage(null);
    try {
      const emailVal = authEmail.trim();
      localStorage.setItem("whipcheck_auth_email", emailVal);
      const { error } = await sendOtpCode(emailVal);
      if (error) {
        setAuthErrorInput(error.message || String(error));
      } else {
        setAuthStep("otp_sent");
        setAuthMessage("Access code sent! Please check your email inbox (and spam folder) for your login OTP.");
      }
    } catch (err: any) {
      setAuthErrorInput(err.message || String(err));
    } finally {
      setAuthLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authOtpCode.trim()) {
      setAuthErrorInput("Please enter the verification code.");
      return;
    }
    setAuthLoading(true);
    setAuthErrorInput(null);
    setAuthMessage(null);
    try {
      const emailVal = authEmail.trim();
      const codeVal = authOtpCode.trim();
      const { data, error } = await verifyOtpCode(emailVal, codeVal);
      if (error) {
        setAuthErrorInput(error.message || String(error));
      } else {
        localStorage.setItem("whipcheck_auth_email", emailVal);
        setAuthMessage("Success! Access granted.");
        setAuthStep("idle");
        setAuthOtpCode("");
        if (data?.user) {
          setCurrentUser(data.user);
          syncUserGarage(data.user);
        }
      }
    } catch (err: any) {
      setAuthErrorInput(err.message || String(err));
    } finally {
      setAuthLoading(false);
    }
  };

  // --- CUSTOM CREDENTIAL BACKEND AUTH SYSTEM ---
  const syncCustomUserGarage = async (userId: string) => {
    const useSupabase = isSupabaseConfigured() && supabase;

    try {
      setIsSupabaseSyncing(true);
      setAccountSyncError(null);
      if (useSupabase) {
        setAccountSyncProgress("🔄 Initiating entire system migration to your Supabase cloud...");
      } else {
        setAccountSyncProgress("🔄 Synchronizing with node-server local database...");
      }

      // 1. Fetch local guest vehicles to migrate
      let localCars: IdentifiedCar[] = [];
      const savedStr = localStorage.getItem("car_spotter_garage_v2_guest");
      if (savedStr) {
        try {
          localCars = JSON.parse(savedStr);
        } catch (e) {
          console.error("Local garage parsing failure during sync:", e);
        }
      }

      setAccountSyncProgress("📥 Loading active vehicles from the node-server database...");
      const res = await fetch(`/api/user/vehicles/${userId}`);
      let serverCars: IdentifiedCar[] = [];
      if (res.ok) {
        const data = await res.json();
        serverCars = data.vehicles || [];
      }

      // Merge and deduplicate vehicles by normalized key to prevent duplicate guest user entries
      const allVehiclesMapByNormalized = new Map<string, IdentifiedCar>();
      
      // Let's populate with server-side cars first so that pre-existing data represents root of truth
      serverCars.forEach(c => {
        if (c) {
          const normKey = getNormalizedCarKey(c);
          if (normKey) {
            allVehiclesMapByNormalized.set(normKey, c);
          } else if (c.id) {
            allVehiclesMapByNormalized.set(c.id, c);
          }
        }
      });
      
      // Merge local guest cars only if they are not already represented by normalized keys
      localCars.forEach(c => {
        if (c) {
          const normKey = getNormalizedCarKey(c);
          if (normKey) {
            if (!allVehiclesMapByNormalized.has(normKey)) {
              allVehiclesMapByNormalized.set(normKey, c);
            }
          } else if (c.id) {
            if (!allVehiclesMapByNormalized.has(c.id)) {
              allVehiclesMapByNormalized.set(c.id, c);
            }
          }
        }
      });
      const uniqueVehicles = Array.from(allVehiclesMapByNormalized.values());

      if (!useSupabase) {
        setAccountSyncProgress("📤 Uploading local guest vehicle scans to node-server database...");
        const unsyncedToNode = localCars.filter(lc => {
          const key = getNormalizedCarKey(lc);
          const hasInServer = serverCars.some(sc => {
            const scKey = getNormalizedCarKey(sc);
            return scKey === key || sc.id === lc.id;
          });
          return !hasInServer;
        });

        if (unsyncedToNode.length > 0) {
          await Promise.all(
            unsyncedToNode.map(async (car) => {
              await fetch(`/api/user/vehicles/${userId}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ vehicle: car })
              }).catch(e => console.warn("Failed back-porting to node-server:", e));
            })
          );
        }

        // Fetch refreshed garage from custom node database
        const refreshNodeRes = await fetch(`/api/user/vehicles/${userId}`);
        let finalCars = uniqueVehicles;
        if (refreshNodeRes.ok) {
          const d = await refreshNodeRes.json();
          finalCars = d.vehicles || uniqueVehicles;
        }

        setGarage(finalCars);
        localStorage.setItem(`car_spotter_garage_v2_${userId}`, JSON.stringify(finalCars));
        localStorage.removeItem("car_spotter_garage_v2_guest");
        localStorage.removeItem("car_spotter_garage_v2");

        setAccountSyncProgress(`✅ SUCCESS: Fully synced account session. Loaded ${finalCars.length} vehicles!`);
        setIsSupabaseSyncing(false);
        return;
      }

      setAccountSyncProgress(`📤 Migrating ${uniqueVehicles.length} vehicle models to "public.vehicles" table on Supabase...`);

      if (uniqueVehicles.length > 0) {
        // Safe batch serialization matching Supabase schema
        const serialized = uniqueVehicles.map((car) => {
          return {
            id: car.id,
            timestamp: car.timestamp,
            image: car.image,
            isCar: car.isCar ?? true,
            make: car.make || null,
            model: car.model || null,
            generation: car.generation || null,
            yearRange: car.yearRange || null,
            confidence: car.confidence || null,
            color: car.color || null,
            category: car.category || null,
            engineType: car.engineType || null,
            power: car.power || null,
            horsepower: car.horsepower || null,
            torque: car.torque || null,
            modelYear: car.modelYear || null,
            zeroToSixty: car.zeroToSixty || null,
            estimatedNewPrice: car.estimatedNewPrice || null,
            estimatedUsedPrice: car.estimatedUsedPrice || null,
            trivia: car.trivia ? (typeof car.trivia === 'string' ? car.trivia : JSON.stringify(car.trivia)) : null,
            tips: car.tips ? (typeof car.tips === 'string' ? car.tips : JSON.stringify(car.tips)) : null,
            specs: car.specs ? (typeof car.specs === 'string' ? car.specs : JSON.stringify(car.specs)) : null,
            user_id: userId
          };
        });

        let { error: carError } = await supabase
          .from("vehicles")
          .upsert(serialized, { onConflict: "id" });

        // Graceful scheme-cache helper: if user's Table doesn't have the user_id column yet, strip user_id and retry
        if (carError && (carError.message.includes("user_id") || carError.message.includes("column") || carError.code === "42703")) {
          console.warn("Retrying vehicles batch upsert without user_id column...");
          setAccountSyncProgress("⚠️ Database table lacks 'user_id' column, retrying fallback match...");
          const serializedNoUser = serialized.map(({ user_id, ...rest }) => rest);
          const retryRes = await supabase
            .from("vehicles")
            .upsert(serializedNoUser, { onConflict: "id" });
          carError = retryRes.error;
        }

        if (carError) {
          throw new Error(`Supabase Vehicles Table error: ${carError.message}`);
        }
      }

      // 2. Fetch comments and ratings from local storage and the servers
      setAccountSyncProgress("📥 Fetching cached and server-side comment reviews & star ratings...");
      const localCommentsList: any[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith("car_comments_")) {
          const carId = k.replace("car_comments_", "");
          try {
            const commentsData = JSON.parse(localStorage.getItem(k) || "[]");
            if (Array.isArray(commentsData)) {
              commentsData.forEach((cmt: any) => {
                localCommentsList.push({ ...cmt, carId });
              });
            }
          } catch (pe) {
            console.warn("Local comments parse failure", pe);
          }
        }
      }

      let serverCommentsList: any[] = [];
      const statsRes = await fetch("/api/admin/database-stats");
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        const rawComments = statsData.rawComments || {};
        Object.entries(rawComments).forEach(([carId, cmtList]: [string, any]) => {
          if (Array.isArray(cmtList)) {
            cmtList.forEach((cmt: any) => {
              serverCommentsList.push({ ...cmt, carId });
            });
          }
        });
      }

      // Merge and deduplicate comments by ID - local guest updates take precedence and overwrite server data
      const allCommentsMap = new Map<string, any>();
      serverCommentsList.forEach(c => { if (c && c.id) allCommentsMap.set(c.id, c); });
      localCommentsList.forEach(c => { if (c && c.id) allCommentsMap.set(c.id, c); });
      const uniqueComments = Array.from(allCommentsMap.values());

      setAccountSyncProgress(`📤 Migrating ${uniqueComments.length} comment reviews & ratings to "public.comments" table on Supabase...`);

      if (uniqueComments.length > 0) {
        const formattedComments = uniqueComments.map(c => ({
          id: c.id,
          car_id: c.carId || c.car_id || "unknown",
          author: c.author || (currentUser ? currentUser.username || currentUser.email : "Anonymous"),
          text: c.text || "",
          timestamp: c.timestamp || new Date().toLocaleString(),
          comfort: typeof c.comfort === 'number' ? c.comfort : null,
          gasConsumption: typeof c.gasConsumption === 'number' ? c.gasConsumption : (typeof c.gas_consumption === 'number' ? c.gas_consumption : null),
          performance: typeof c.performance === 'number' ? c.performance : null,
          reliability: typeof c.reliability === 'number' ? c.reliability : null
        }));

        const { error: commentErr } = await supabase
          .from("comments")
          .upsert(formattedComments, { onConflict: "id" });

        if (commentErr) {
          throw new Error(`Supabase Comments Table error: ${commentErr.message}`);
        }
      }

      setAccountSyncProgress("🔄 Reloading fully synchronized database views...");
      
      // Sync local servers first too
      if (uniqueVehicles.length > 0) {
        await Promise.all(
          uniqueVehicles.map(async (car) => {
            await fetch(`/api/user/vehicles/${userId}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ vehicle: car })
            }).catch(e => console.warn("Failed back-porting to server node-db during sync:", e));
          })
        );
      }

      // Fetch refreshed database from Supabase and set as active local storage
      const freshCars = await fetchSupabaseGarage(userId);
      setGarage(freshCars);
      localStorage.setItem(`car_spotter_garage_v2_${userId}`, JSON.stringify(freshCars));
      
      // Invalidate guest caches after successful migration
      localStorage.removeItem("car_spotter_garage_v2_guest");
      localStorage.removeItem("car_spotter_garage_v2");

      setSupabaseStatus("synced");
      setSupabaseError(null);
      setAccountSyncProgress(`✅ SUCCESS: Fully migrated user session, ${uniqueVehicles.length} vehicle scans, and ${uniqueComments.length} comment and ratings logs successfully to Supabase!`);
    } catch (err: any) {
      console.error("Custom user failed sync:", err);
      setSupabaseStatus("error");
      setSupabaseError(err.message || String(err));
      setAccountSyncError(`Migration Failed: ${err.message || String(err)}`);
      setAccountSyncProgress(null);
    } finally {
      setIsSupabaseSyncing(false);
    }
  };

  const handleCustomSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authUsername.trim()) {
      setAuthErrorInput("Please provide a username.");
      return;
    }
    if (!authEmail.trim()) {
      setAuthErrorInput("Please provide a valid email address.");
      return;
    }
    if (!authPassword.trim()) {
      setAuthErrorInput("Please provide a password.");
      return;
    }
    if (authPassword !== authConfirmPassword) {
      setAuthErrorInput("Passwords do not match.");
      return;
    }

    setAuthLoading(true);
    setAuthErrorInput(null);
    setAuthMessage(null);

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: authUsername.trim(),
          email: authEmail.trim(),
          password: authPassword.trim()
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Form validation failed.");
      }

      setAuthMessage(data.message || "Registration successful! A one-time verification PIN has been dispatched to your email address.");
      setAuthFormMode('otp_verify');
      setDevOtpCode(data.otpCode || "");
      setAuthOtpCode("");
      setAuthPassword("");
      setAuthConfirmPassword("");
    } catch (err: any) {
      setAuthErrorInput(err.message || String(err));
    } finally {
      setAuthLoading(false);
    }
  };

  const handleCustomLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authEmail.trim()) {
      setAuthErrorInput("Please enter your Username or Email address.");
      return;
    }
    if (!authPassword.trim()) {
      setAuthErrorInput("Please enter your Password.");
      return;
    }

    setAuthLoading(true);
    setAuthErrorInput(null);
    setAuthMessage(null);
    setDevOtpCode("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          loginId: authEmail.trim(),
          password: authPassword.trim()
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Incorrect login credentials.");
      }

      if (data.status === "otp_required") {
        setAuthEmail(data.email);
        setAuthFormMode('otp_verify');
        setAuthOtpCode("");
        setDevOtpCode(data.otpCode || "");
        setAuthMessage("🔒 First-time login: Email verification required. Please enter your 6-digit OTP code below.");
      } else if (data.status === "success" && data.user) {
        setCurrentUser(data.user);
        localStorage.setItem("whipcheck_user_session", JSON.stringify(data.user));
        localStorage.setItem("whipcheck_auth_email", data.user.email);
        setAuthMessage("Success! Secure session established.");
        setAuthUsername("");
        setAuthPassword("");
        setAuthConfirmPassword("");
        await syncCustomUserGarage(data.user.id);
      }
    } catch (err: any) {
      setAuthErrorInput(err.message || String(err));
    } finally {
      setAuthLoading(false);
    }
  };

  const handleCustomVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authOtpCode.trim()) {
      setAuthErrorInput("Please enter the 6-digit OTP code.");
      return;
    }

    setAuthLoading(true);
    setAuthErrorInput(null);
    setAuthMessage(null);

    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: authEmail.trim(),
          otp: authOtpCode.trim()
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Invalid OTP code provided.");
      }

      if (data.status === "success" && data.user) {
        setCurrentUser(data.user);
        localStorage.setItem("whipcheck_user_session", JSON.stringify(data.user));
        localStorage.setItem("whipcheck_auth_email", data.user.email);
        setAuthMessage("Success! Access granted. Your email is now verified.");
        setAuthFormMode('signin');
        setAuthOtpCode("");
        setDevOtpCode("");
        setAuthUsername("");
        setAuthPassword("");
        await syncCustomUserGarage(data.user.id);
      }
    } catch (err: any) {
      setAuthErrorInput(err.message || String(err));
    } finally {
      setAuthLoading(false);
    }
  };

  const handleCustomResendOtp = async () => {
    setAuthLoading(true);
    setAuthErrorInput(null);
    setAuthMessage(null);
    setDevOtpCode("");

    try {
      const res = await fetch("/api/auth/resend-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: authEmail.trim() })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to resend verification code.");
      }

      setDevOtpCode(data.otpCode || "");
      setAuthMessage("A fresh 6-digit verification code has been dispatched. Check below.");
    } catch (err: any) {
      setAuthErrorInput(err.message || String(err));
    } finally {
      setAuthLoading(false);
    }
  };

  const handleCustomLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem("whipcheck_user_session");
    setAuthEmail("");
    setAuthFormMode('signin');
    setAuthMessage("Logged out successfully.");
    setAuthErrorInput(null);
    
    // Clear Supabase session as well if it was initialized to prevent lingering auth scopes
    if (isSupabaseConfigured() && supabase) {
      supabase.auth.signOut().catch(err => console.warn("Supabase background signout failed during custom logout", err));
    }
    
    // Stop camera and reset current scan process
    stopCamera();
    setScanStep('idle');
    setImageUrl(null);
    setIdentifiedCar(null);
    setErrorMsg(null);
    setLoadingStatusText("Initializing...");
    setUrlInput("");

    // Restore guest garage context upon user logout
    const guestSaved = localStorage.getItem("car_spotter_garage_v2_guest");
    if (guestSaved) {
      try {
        setGarage(JSON.parse(guestSaved));
      } catch (e) {
        setGarage([]);
      }
    } else {
      setGarage([]);
    }
    setSupabaseStatus("idle");
  };

  const handleSocialPlatformLogin = async (provider: "google" | "github" | "discord") => {
    setAuthLoading(true);
    setAuthErrorInput(null);
    setAuthMessage(null);
    try {
      await signInWithSocial(provider);
    } catch (err: any) {
      setAuthErrorInput(err.message || String(err));
      setAuthLoading(false);
    }
  };

  const handleUserLogout = async () => {
    setAuthLoading(true);
    try {
      if (currentUser && currentUser.id && localStorage.getItem("whipcheck_user_session")) {
        handleCustomLogout();
        // Clear Supabase as well as safe background step
        if (isSupabaseConfigured() && supabase) {
          try {
            await signOutUser();
          } catch (e) {}
        }
        return;
      }
      if (isSupabaseConfigured() && supabase) {
        await signOutUser();
      }
      
      // Stop camera and reset current scan process
      stopCamera();
      setScanStep('idle');
      setImageUrl(null);
      setIdentifiedCar(null);
      setErrorMsg(null);
      setLoadingStatusText("Initializing...");
      setUrlInput("");

      setCurrentUser(null);
      const guestSaved = localStorage.getItem("car_spotter_garage_v2_guest");
      if (guestSaved) {
        try {
          setGarage(JSON.parse(guestSaved));
        } catch (e) {
          setGarage([]);
        }
      } else {
        setGarage([]);
      }
      setAuthMessage("Signed out successfully.");
      setTimeout(() => setAuthMessage(null), 3000);
    } catch (err: any) {
      setAuthErrorInput(err.message || String(err));
    } finally {
      setAuthLoading(false);
    }
  };

  return (
    <div className={`min-h-screen ${activeTheme.primaryBg} text-slate-200 flex flex-col font-sans antialiased transition-colors duration-300 md:py-6 md:px-4`}>
      
      {/* Primary Container - Sized like a sleek modern mobile app on desktop, fully fluid on mobile */}
      <div className={`w-full max-w-md mx-auto ${activeTheme.cardBg} border-0 md:border md:border-slate-800 md:rounded-3xl shadow-2xl ${activeTheme.glowClass} flex flex-col overflow-hidden min-h-screen md:min-h-[840px] relative transition-all duration-300`}>
        
        {/* HUD Scanner Top Bar Grid */}
        <header className="p-4 border-b border-slate-850 bg-slate-900/35 relative overflow-hidden shrink-0">
          <div className={`absolute top-0 right-0 h-16 w-16 ${activeTheme.pulseBg}/5 rounded-full blur-xl pointer-events-none`}></div>
          
          <div className="flex items-center justify-between relative z-10 w-full">
            {/* Trendy Sportive Logo and App Name */}
            <div className="flex items-center gap-2.5">
              <div className={`relative flex items-center justify-center w-9 h-9 rounded-xl ${activeTheme.accentBg} text-slate-950 font-bold shadow-lg shadow-black/40 shrink-0 transform -skew-x-12 hover:skew-x-0 transition-all duration-300`}>
                <div className="absolute inset-0 bg-white/20 rounded-xl"></div>
                <Gauge className="w-5 h-5 text-slate-950 relative z-10" />
              </div>
              
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <span className={`text-[8px] font-mono tracking-widest text-slate-950 font-extrabold uppercase ${activeTheme.accentBg} px-1.5 py-0.5 rounded`}>GT</span>
                  <h1 className="text-sm font-black tracking-tight text-slate-100 font-display">WHIPCHECK</h1>
                </div>
                <p className="text-[9.5px] text-zinc-400 uppercase font-mono tracking-wider font-semibold">Enthusiast Car Detector</p>
              </div>
            </div>
          </div>
        </header>

        {/* SPORT LIVERIES TUNER SELECTOR */}
        <div className="px-4 py-2.5 bg-black/45 border-b border-slate-850/60 flex items-center justify-between gap-2 overflow-x-auto scrollbar-none shrink-0 transition-colors duration-350">
          <div className="flex items-center gap-1 shrink-0 font-mono text-[9px] uppercase tracking-wider text-slate-400 font-bold">
            <Sparkles className={`h-3.5 w-3.5 ${activeTheme.primaryText}`} />
            <span>Livery Theme:</span>
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
            {Object.values(THEMES).map((t) => {
              const isSelected = t.id === currThemeId;
              return (
                <button
                  key={t.id}
                  onClick={() => setCurrThemeId(t.id)}
                  className={`px-2.5 py-1 rounded-xl flex items-center gap-1 text-[10px] font-mono transition-all border cursor-pointer select-none font-bold shrink-0 ${
                    isSelected 
                      ? `${t.accentBg} ${t.accentBorder} text-slate-900 border-white/40 shadow-md scale-102` 
                      : 'bg-slate-900/60 hover:bg-slate-800 border-slate-800/80 text-slate-300'
                  }`}
                  title={`${t.name} (${t.brand})`}
                >
                  <span className="inline-block w-2.5 h-2.5 rounded-full border border-black/20 shrink-0" style={{ backgroundColor: t.colorHex }}></span>
                  <span className={isSelected ? 'text-slate-900' : 'text-slate-200'}>{t.id.toUpperCase()}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Dynamic App Body Workspace (Flowing or Scrolling) */}
        <main className="flex-1 overflow-y-auto p-4 space-y-5">
          
          {/* Simulated Outbox/Inbox Alerts */}
          {devOtpCode && (
            <div className="p-3.5 bg-indigo-950/90 border border-indigo-500/35 rounded-2xl space-y-1.5 shadow-xl shadow-indigo-950/50 animate-fade-in relative z-10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span className="text-[10px] font-black tracking-widest text-indigo-300 font-mono uppercase">✉️ SIMULATED MAILBOX DISPATCH</span>
                </div>
                <button 
                  onClick={() => setDevOtpCode("")}
                  className="text-[10px] text-zinc-400 hover:text-white cursor-pointer font-bold font-mono px-1.5 py-0.5 bg-black/40 rounded border border-indigo-500/20"
                >
                  Dismiss
                </button>
              </div>
              
              <div className="space-y-1 bg-black/60 p-2.5 rounded-xl border border-indigo-500/10 font-mono text-[10px] leading-normal text-slate-300">
                <p className="text-zinc-500 border-b border-indigo-950/40 pb-1.5 mb-1.5 flex justify-between">
                  <span>To: <strong className="text-indigo-200 select-all">{authEmail || "Guest user"}</strong></span>
                  <span className="text-[8px] text-slate-500 font-bold uppercase shrink-0">WhipCheck Courier</span>
                </p>
                <p className="text-slate-300">
                  Your dynamic secure 6-digit access OTP is:
                </p>
                <div className="flex items-center justify-between bg-indigo-950/40 p-2 rounded-lg border border-indigo-500/20 mt-2">
                  <span className="text-sm font-black tracking-widest text-emerald-400 font-mono select-all">{devOtpCode}</span>
                  <span className="text-[8.5px] text-indigo-400 uppercase font-bold shrink-0">Tap to Copy</span>
                </div>
              </div>
            </div>
          )}

          {/* Short Catchy Guest Loss Warning Bar */}
          {!currentUser && garage.length > 0 && (
            <div className="p-3 bg-red-950/25 border border-red-500/20 rounded-2xl flex items-center justify-between gap-3 shadow-md shadow-red-950/10 animate-pulse-slow">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-1.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-100 shrink-0">
                  <ShieldAlert className="h-4 w-4 text-red-400" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-[9.5px] font-black uppercase tracking-wider text-red-400 font-mono">⚠️ Guest Session Sandbox</h4>
                  <p className="text-[9.5px] text-slate-300 leading-tight">
                    Active scans will be permanently wiped if you log out or switch devices.
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setActiveTab('account')}
                className="px-2.5 py-1 text-[9px] font-mono font-bold uppercase tracking-wider text-slate-900 bg-red-500 hover:bg-red-400 transition-all rounded-lg shrink-0 cursor-pointer shadow-md shadow-red-950/20"
              >
                Sync Now
              </button>
            </div>
          )}
          
          {/* TAB 1: VISION SCANNER SCREEN */}
          {activeTab === 'scan' && (
            <div className="space-y-5">
              
              {/* API Key Missing Notice */}
              {apiKeyConfigured === false && (
                <div className="p-3 bg-amber-950/20 border border-amber-500/20 rounded-xl space-y-1.5 text-xs flex flex-col shadow-md">
                  <div className="flex items-start gap-2">
                    <ShieldAlert className="h-4 w-4 text-amber-500 shrink-0 mt-0.5 animate-pulse" />
                    <div className="space-y-0.5">
                      <p className="font-bold text-amber-400">Gemini Key Needed (Production Mode)</p>
                      <p className="text-[11px] text-zinc-300 leading-normal">
                        To enable core Vision AI scans on your hosting provider, please configure the <code className="px-1 py-0.5 bg-black/40 rounded font-mono text-amber-300">GEMINI_API_KEY</code> environment secret.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Standalone open tab notice if inside iframe sandbox */}
              {isInIframe && (
                <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-2 text-xs flex flex-col gap-2 shadow-lg">
                  <div className="space-y-0.5">
                    <p className={`font-bold ${activeTheme.primaryText} flex items-center gap-1`}>
                      <Layers className={`h-3.5 w-3.5 ${activeTheme.primaryText} animate-pulse`} />
                      Safari/Chrome Iframe Constraint
                    </p>
                    <p className="text-[11px] text-slate-300 leading-normal">
                      Mobile browsers block Cameras & direct paste controls inside nested site previews. For unrestricted camera/upload support, run standalone.
                    </p>
                  </div>
                  <a
                    href={window.location.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`inline-flex items-center justify-center gap-1.5 ${activeTheme.accentBg} ${activeTheme.accentHover} text-slate-950 font-bold text-xs px-3 py-2 rounded-lg shrink-0 transition`}
                  >
                    <span className="text-black">Open Standalone Tab</span>
                    <ChevronRight className="h-3 w-3 text-black" />
                  </a>
                </div>
              )}

              {/* Scan Workspace Frame Selector */}
              {scanStep === 'idle' && (
                <div className="space-y-4">
                  {/* Futuristic Interactive Viewport Hero */}
                  <div className="p-6 rounded-2xl border border-slate-800 bg-[#07080a] text-center relative overflow-hidden group">
                    <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: `radial-gradient(${activeTheme.colorHex} 1px, transparent 1px)`, backgroundSize: "16px 16px" }}></div>
                    
                    {/* Viewport Brackets decoration */}
                    <div className={`absolute top-3 left-3 w-4 h-4 border-t border-l ${activeTheme.accentBorder} pointer-events-none`}></div>
                    <div className={`absolute top-3 right-3 w-4 h-4 border-t border-r ${activeTheme.accentBorder} pointer-events-none`}></div>
                    <div className={`absolute bottom-3 left-3 w-4 h-4 border-b border-l ${activeTheme.accentBorder} pointer-events-none`}></div>
                    <div className={`absolute bottom-3 right-3 w-4 h-4 border-b border-r ${activeTheme.accentBorder} pointer-events-none`}></div>

                    <div className="my-3 flex justify-center">
                      <div className={`p-3.5 bg-black/40 ${activeTheme.primaryText} rounded-2xl border ${activeTheme.accentBorder} group-hover:scale-110 transition-transform duration-300`}>
                        <CameraIcon className="w-8 h-8 pointer-events-none" />
                      </div>
                    </div>
                    
                    <h2 className="text-sm font-bold text-slate-100 font-display uppercase tracking-wide">Acquire Target Vehicle</h2>
                    <p className="text-xs text-slate-450 mt-2 max-w-xs mx-auto leading-relaxed">
                      Initialize the mobile camera alignment view or select a stored file to automatically extract model configurations.
                    </p>

                    <div className="grid grid-cols-2 gap-3 mt-5">
                      <button
                        onClick={startCamera}
                        className={`flex items-center justify-center gap-1.5 ${activeTheme.accentBg} ${activeTheme.accentHover} text-white font-bold text-xs py-3.5 px-2 rounded-xl transition duration-200 cursor-pointer shadow-lg ${activeTheme.glowClass} active:scale-98`}
                      >
                        <CameraIcon className="h-4 w-4 text-black" />
                        <span className="text-black">Live Camera</span>
                      </button>

                      <label
                        htmlFor="car-file-upload"
                        className="flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white font-bold text-xs py-3.5 px-2 rounded-xl transition duration-200 cursor-pointer active:scale-98 shadow-md"
                      >
                        <Upload className={`h-4 w-4 ${activeTheme.primaryText}`} />
                        <span>Upload File</span>
                      </label>
                    </div>

                    {/* Pasted Image URL bar */}
                    <div className="flex items-center gap-2 my-5">
                      <div className="h-[1px] bg-slate-800 flex-1"></div>
                      <span className="text-[9px] font-mono tracking-widest text-slate-400 uppercase font-semibold">OR ENTER DIRECT URL</span>
                      <div className="h-[1px] bg-slate-800 flex-1"></div>
                    </div>

                    <form 
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (urlInput.trim()) {
                          handleSelectSample(urlInput.trim());
                        }
                      }}
                      className="flex gap-2"
                    >
                      <input
                        type="url"
                        value={urlInput}
                        onChange={(e) => setUrlInput(e.target.value)}
                        placeholder="Type or paste image link..."
                        className={`flex-1 bg-slate-900 border border-slate-600 text-slate-50 placeholder-slate-400 rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-slate-500 focus:ring-1 focus:ring-white/10 transition font-mono`}
                        required
                      />
                      <button
                        type="submit"
                        disabled={!urlInput.trim()}
                        className={`disabled:bg-slate-850 disabled:text-slate-500 border border-transparent disabled:border-slate-800 font-bold text-xs px-4 py-2.5 rounded-xl transition cursor-pointer shrink-0 uppercase tracking-widest font-mono shadow-md disabled:cursor-not-allowed ${
                          urlInput.trim() ? `${activeTheme.accentBg} ${activeTheme.accentHover} text-black` : 'bg-slate-800 text-slate-500'
                        }`}
                      >
                        SCAN
                      </button>
                    </form>

                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-1 mt-2.5 px-1">
                      <span className="text-[9px] text-slate-500 font-mono">Tap target to auto-scan instantly:</span>
                      <div className="flex gap-2 font-semibold">
                        <button
                          type="button"
                          onClick={() => handleSelectSample("https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&q=80&w=800")}
                          className={`text-[9px] ${activeTheme.primaryText} hover:underline font-mono cursor-pointer`}
                        >
                          Porsche 911
                        </button>
                        <span className="text-slate-700 text-[9px]">•</span>
                        <button
                          type="button"
                          onClick={() => handleSelectSample("https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&q=80&w=800")}
                          className={`text-[9px] ${activeTheme.primaryText} hover:underline font-mono cursor-pointer`}
                        >
                          Corvette
                        </button>
                      </div>
                    </div>

                    <input
                      type="file"
                      id="car-file-upload"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      accept="image/*"
                      className="hidden"
                    />
                  </div>

                  {/* Active Samples Gallery */}
                  <SampleCarousel onSelectSample={handleSelectSample} disabled={false} />

                  {/* Tips for Best Results */}
                  <div className="p-3 bg-slate-900/35 border border-slate-850/80 rounded-xl space-y-1 text-[10.5px]">
                    <span className={`block text-[9px] font-mono tracking-wider font-extrabold uppercase ${activeTheme.primaryText}`}>💡 Dynamic Spotter Tip</span>
                    <p className="text-zinc-400 leading-relaxed font-sans mt-0.5">
                      For peak accuracy, capture high-contrast side viewpoints or 3/4 front profiles in clear lighting.
                    </p>
                  </div>
                </div>
              )}

              {/* Step 2: Camera Viewport Active */}
              {scanStep === 'capture' && (
                <div className="space-y-4">
                  <div className={`relative aspect-[3/4] rounded-2xl overflow-hidden bg-black border ${activeTheme.accentBorder}`}>
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      className="w-full h-full object-cover"
                    />

                    {/* Scanner High Density Overlay decoration */}
                    <div className="absolute inset-0 pointer-events-none">
                      {/* Grid Target Frame */}
                      <div className="absolute inset-8 border border-white/10 rounded-lg">
                        <div className={`absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2`} style={{ borderColor: activeTheme.colorHex }}></div>
                        <div className={`absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2`} style={{ borderColor: activeTheme.colorHex }}></div>
                        <div className={`absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2`} style={{ borderColor: activeTheme.colorHex }}></div>
                        <div className={`absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2`} style={{ borderColor: activeTheme.colorHex }}></div>
                        
                        {/* Horizontal Pulsing scan sweep laser */}
                        <div className="scanner-laser absolute left-0 right-0 h-1 filter blur-[0.5px]" style={{ backgroundColor: activeTheme.colorHex, boxShadow: `0 0 10px ${activeTheme.colorHex}` }}></div>
                      </div>

                      {/* Diagnostic HUD coordinates info overlay */}
                      <div className={`absolute top-3 left-4 bg-black/75 backdrop-blur-md px-2 py-1 rounded border ${activeTheme.accentBorder} text-[8px] font-mono ${activeTheme.primaryText}`}>
                        RADAR_SIG: [ONLINE]
                        <div className="text-[7px] text-slate-400 mt-0.5">VELOCITY: 0.0 KM/H</div>
                      </div>

                      <div className={`absolute bottom-3 right-4 bg-black/75 backdrop-blur-md px-2 py-1 rounded border ${activeTheme.accentBorder} text-[8px] font-mono ${activeTheme.primaryText}`}>
                        SIGHT SCANNER IP
                        <div className="text-[7px] text-slate-400 mt-0.5">ISO 400 | AF_C</div>
                      </div>
                    </div>
                  </div>

                  {/* Camera Control Action buttons */}
                  <div className="flex gap-3 justify-center items-center">
                    <button
                      onClick={triggerReset}
                      className="px-4 py-3 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-200 text-xs font-semibold rounded-xl flex items-center gap-1 transition cursor-pointer"
                    >
                      <RotateCcw className="h-4 w-4" /> Reset
                    </button>

                    <button
                      onClick={capturePhoto}
                      className={`w-16 h-16 rounded-full border-4 ${activeTheme.accentBorder} bg-white/5 hover:bg-white/10 flex items-center justify-center hover:scale-105 transition-all duration-300 transform active:scale-95 cursor-pointer`}
                      style={{ boxShadow: `0 0 15px ${activeTheme.colorHex}30` }}
                    >
                      <div className="w-10 h-10 rounded-full" style={{ backgroundColor: activeTheme.colorHex }}></div>
                    </button>

                    <label
                      htmlFor="car-file-upload"
                      className="px-4 py-3 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-200 text-xs font-semibold rounded-xl flex items-center gap-1 transition cursor-pointer"
                    >
                      <Upload className="h-4 w-4" /> Gallery
                    </label>
                  </div>
                </div>
              )}

              {/* Step 3: Loading States with Immersive Tech Steps */}
              {(scanStep === 'uploading' || scanStep === 'enhancing' || scanStep === 'parsing_vision') && (
                <div className="p-8 rounded-2xl border border-slate-800 bg-[#0c0d11] text-center space-y-6 relative overflow-hidden">
                  <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ backgroundImage: `radial-gradient(${activeTheme.colorHex} 1px, transparent 1px)`, backgroundSize: "20px 20px" }}></div>
                  
                  <div className="flex justify-center relative">
                    {/* Animated spinning scanner radar */}
                    <div className="relative w-23.5 h-20">
                      <div className="absolute inset-0 border-4 border-slate-900 rounded-full"></div>
                      <div className="absolute inset-0 border-4 border-t-transparent rounded-full animate-spin" style={{ borderTopColor: activeTheme.colorHex }}></div>
                      <div className="absolute inset-3 border border-slate-800/80 rounded-full flex items-center justify-center bg-slate-950 shadow-inner">
                        <Loader2 className={`h-6 w-6 ${activeTheme.loaderText} animate-pulse`} />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className={`text-xs font-mono font-bold tracking-[0.2em] ${activeTheme.primaryText} uppercase`}>
                      Neural core scanning
                    </p>
                    <h3 className="text-sm font-bold text-slate-100 font-display">
                      {loadingStatusText}
                    </h3>
                    <p className="text-[10px] text-slate-500 max-w-xs mx-auto leading-relaxed">
                      AI computer vision model is detecting visual structures, bumper profiles, tail lamps, and manufacturer signatures. Please hold on...
                    </p>
                  </div>

                  {/* Stop scanning cancellation triggers */}
                  <div className="pt-2 animate-fade-in">
                    <button
                      type="button"
                      onClick={handleStopScan}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold font-mono text-rose-450 hover:text-white bg-[#e11d48]/10 hover:bg-[#e11d48]/20 border border-[#e11d48]/20 hover:border-[#e11d48]/45 transition-all duration-200 uppercase cursor-pointer tracking-wider"
                    >
                      <StopCircle className="h-4 w-4 shrink-0 text-red-500" />
                      <span>Stop & Cancel Scan</span>
                    </button>
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
                <div className="p-6 rounded-2xl border border-red-500/20 bg-[#160b0b] text-center space-y-4">
                  <div className="inline-block p-3 bg-red-500/10 text-red-400 rounded-full border border-red-500/20">
                    <ShieldAlert className="h-6 w-6" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-slate-200 uppercase font-display">Target Scan Failed</h3>
                    <p className="text-xs text-slate-450 leading-relaxed max-w-xs mx-auto">
                      {errorMsg || "An unexpected error occurred during frame recognition."}
                    </p>
                  </div>
                  <div className="pt-2">
                    <button
                      onClick={triggerReset}
                      className={`w-full ${activeTheme.accentBg} ${activeTheme.accentHover} text-slate-900 font-bold text-xs py-3 rounded-xl transition cursor-pointer`}
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
                <span className={`bg-slate-900 border border-slate-800 text-[10px] font-mono px-2 py-0.5 rounded-full ${activeTheme.primaryText}`}>
                  {garage.length} Vehicles
                </span>
              </div>

              {compareError && (
                <div className="p-3 bg-red-950/40 border border-red-500/15 rounded-xl text-red-100 text-[10px] leading-relaxed flex items-center gap-2 font-mono animate-fade-in">
                  <ShieldAlert className="h-4 w-4 shrink-0 text-red-500" />
                  <span>{compareError}</span>
                </div>
              )}

              {/* Search and Database Controls */}
              {!selectedGarageCar && !showCompareActive && garage.length > 0 && (
                <div className="bg-slate-900/40 p-3 rounded-xl border border-slate-850 space-y-2.5">
                  {/* Search input with clear button */}
                  <div className="relative">
                    <Search className={`absolute left-3 top-2.5 h-3.5 w-3.5 ${activeTheme.primaryText}`} />
                    <input
                      type="text"
                      placeholder="Search brand, model, specs, color..."
                      value={garageSearch}
                      onChange={(e) => setGarageSearch(e.target.value)}
                      className="w-full bg-slate-950/80 border border-slate-800 text-slate-100 placeholder-slate-500 rounded-lg pl-9 pr-8 py-2 text-xs focus:ring-1 focus:ring-slate-500/30 focus:border-slate-500 font-medium font-sans"
                    />
                    {garageSearch && (
                      <button
                        onClick={() => setGarageSearch("")}
                        className="absolute right-3 top-2 text-slate-400 hover:text-slate-200 text-xs font-mono font-bold cursor-pointer"
                      >
                        ×
                      </button>
                    )}
                  </div>

                  {/* Selectors row */}
                  <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                    {/* Sort Selector */}
                    <div className="space-y-1">
                      <label className="text-[9px] text-slate-500 uppercase tracking-wider block font-semibold">Sort order</label>
                      <div className="relative">
                        <select
                          value={garageSortBy}
                          onChange={(e) => setGarageSortBy(e.target.value)}
                          className="w-full bg-slate-950/90 border border-slate-800 text-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-slate-750 cursor-pointer text-xs"
                        >
                          <option value="newest">Newest Added</option>
                          <option value="brand">Brand (A-Z)</option>
                          <option value="year">Model Year</option>
                          <option value="confidence">Confidence Score</option>
                        </select>
                      </div>
                    </div>

                    {/* Group By Selector */}
                    <div className="space-y-1">
                      <label className="text-[9px] text-slate-500 uppercase tracking-wider block font-semibold">Grouping</label>
                      <div className="relative">
                        <select
                          value={garageGroupBy}
                          onChange={(e) => setGarageGroupBy(e.target.value)}
                          className="w-full bg-slate-950/90 border border-slate-800 text-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-slate-750 cursor-pointer text-xs"
                        >
                          <option value="none">Flat List (None)</option>
                          <option value="brand">By Brand/Make</option>
                          <option value="category">By Category</option>
                          <option value="color">By Paint Color</option>
                        </select>
                      </div>
                    </div>
                  </div>
                  
                  {/* Filter state readout */}
                  {(garageSearch || garageSortBy !== "newest" || garageGroupBy !== "none") && (
                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1.5 border-t border-slate-850/40">
                      <span>
                        Found <strong className={`${activeTheme.primaryText}`}>{sortedGarage.length}</strong> of {garage.length} vehicles
                      </span>
                      <button 
                        onClick={() => {
                          setGarageSearch("");
                          setGarageSortBy("newest");
                          setGarageGroupBy("none");
                        }}
                        className="text-[9px] text-red-400 hover:underline hover:text-red-300 uppercase tracking-wider font-bold cursor-pointer"
                      >
                        Reset filters
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Select Garage Car or list of saved items */}
              {showCompareActive ? (
                <CarComparison
                  cars={compareList}
                  onClose={() => setShowCompareActive(false)}
                  onRemoveFromCompare={(id) => {
                    setCompareList((prev) => prev.filter((c) => c.id !== id));
                  }}
                  activeTheme={activeTheme}
                />
              ) : selectedGarageCar ? (
                <div className="space-y-3">
                  <button
                    onClick={() => setSelectedGarageCar(null)}
                    className={`text-xs ${activeTheme.primaryText} hover:underline font-bold font-mono uppercase tracking-wider flex items-center gap-1 mb-2 cursor-pointer`}
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
                    className={`inline-block ${activeTheme.accentBg} ${activeTheme.accentHover} text-slate-950 font-bold text-xs px-4 py-2 rounded-xl transition cursor-pointer`}
                  >
                    Start Spotting
                  </button>
                </div>
              ) : sortedGarage.length === 0 ? (
                /* No Results Found for Search query state */
                <div className="p-8 rounded-2xl border border-slate-850 bg-slate-900/10 text-center space-y-3">
                  <div className="inline-block p-3 bg-slate-900 text-slate-500 rounded-full border border-slate-800">
                    <Search className="h-6 w-6" />
                  </div>
                  <h3 className="text-xs font-bold text-slate-300 uppercase font-display">No Matches Found</h3>
                  <p className="text-[11px] text-slate-500 leading-relaxed max-w-xs mx-auto">
                    No vehicles match your search query: "{garageSearch}". Check your spelling or reset filters.
                  </p>
                  <button
                    onClick={() => {
                      setGarageSearch("");
                      setGarageSortBy("newest");
                      setGarageGroupBy("none");
                    }}
                    className={`inline-block ${activeTheme.accentBg} ${activeTheme.accentHover} text-slate-950 font-bold text-xs px-4 py-2 rounded-xl transition cursor-pointer`}
                  >
                    Reset All Filters
                  </button>
                </div>
              ) : (
                /* Scans database list style with possible grouping */
                <div className="space-y-5">
                  {groupedGarage.map((group) => (
                    <div key={group.groupTitle || "all"} className="space-y-2.5">
                      {group.groupTitle && (
                        <div className="flex items-center justify-between px-2.5 py-1 bg-slate-900/30 border-l-[3px] border-l-blue-500/60 rounded-r-lg" style={{ borderLeftColor: activeTheme.colorHex }}>
                          <span className={`text-[10px] font-bold font-mono ${activeTheme.primaryText} tracking-wider uppercase block`}>
                            {group.groupTitle}
                          </span>
                          <span className="text-[9px] font-mono text-slate-500">
                            {group.cars.length} {group.cars.length === 1 ? 'vehicle' : 'vehicles'}
                          </span>
                        </div>
                      )}
                      
                      <div className="space-y-3">
                        {group.cars.map((car) => {
                          const normKey = getNormalizedCarKey(car);
                          const meta = garageCommentsMeta[normKey];
                          const hasComments = meta && meta.count > 0;

                          let lastSeenInfo = null;
                          try {
                            const saved = localStorage.getItem(`comments_last_seen_${normKey}`);
                            if (saved) {
                              lastSeenInfo = JSON.parse(saved);
                            }
                          } catch (e) {}

                          const hasNewComments = hasComments && (
                            !lastSeenInfo ||
                            meta.count > lastSeenInfo.lastSeenCount ||
                            (lastSeenInfo.lastSeenId && meta.lastId !== lastSeenInfo.lastSeenId)
                          );

                          return (
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

                              <div className="flex-1 min-w-0 flex flex-col justify-between font-sans">
                                <div>
                                  <div className="flex items-center justify-between gap-1.5">
                                    <span className="text-[9px] uppercase font-mono text-emerald-400 tracking-wider">
                                      {car.category}
                                    </span>
                                    <span className="text-[8px] font-mono text-slate-500">
                                      {car.timestamp}
                                    </span>
                                  </div>
                                  <h4 className={`text-xs font-bold font-display text-slate-200 uppercase truncate group-hover:${activeTheme.primaryText} transition-colors`}>
                                    {car.make} {car.model}
                                  </h4>
                                  <p className="text-[10px] text-slate-400 truncate mt-0.5">
                                    Specs: {car.specs?.transmission || "N/A"} • {car.specs?.driveType || "N/A"}
                                  </p>

                                  {/* Dynamic Comment Counts & Glowing notifications */}
                                  {hasComments && (
                                    <div className="flex items-center gap-1 mt-1 text-[10px] font-mono select-none">
                                      <span className={`px-2 py-0.5 rounded border flex items-center gap-1 transition ${
                                        hasNewComments
                                          ? "bg-amber-500/10 text-amber-400 border-amber-500/30 font-bold animate-pulse"
                                          : "bg-slate-950 text-slate-400 border-slate-800"
                                      }`}>
                                        <MessageSquare className="h-2.5 w-2.5 shrink-0" />
                                        <span>
                                          {meta.count} {meta.count === 1 ? 'Comment' : 'Comments'}
                                        </span>
                                        {hasNewComments && (
                                          <span className="inline-flex items-center px-1.5 py-0.2 rounded-full text-[7.5px] bg-amber-500 text-amber-950 font-black uppercase tracking-wider animate-bounce ml-0.5 whitespace-nowrap">
                                            NEW
                                          </span>
                                        )}
                                      </span>
                                    </div>
                                  )}
                                </div>

                                <div className="flex justify-between items-center mt-1">
                                  <span className="text-[10px] font-mono font-semibold text-teal-400">
                                    {car.estimatedUsedPrice || "Est. Resale N/A"}
                                  </span>
                                  
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      onClick={(e) => handleToggleCompare(car, e)}
                                      className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-lg border transition duration-200 flex items-center gap-1 ${
                                        compareList.some(c => c.id === car.id)
                                          ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                                          : "bg-slate-950/60 text-slate-400 border-slate-805 hover:text-slate-200 hover:border-slate-755"
                                      }`}
                                      title="Compare with other vehicles"
                                    >
                                      <Scale className="h-2.5 w-2.5" />
                                      <span>{compareList.some(c => c.id === car.id) ? "Comparing" : "Compare"}</span>
                                    </button>

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
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

            </div>
          )}

          {/* TAB 4: SECURED CLOUD PORTAL & AUTHENTICATION */}
          {activeTab === 'account' && (
            <div className="space-y-6 animate-fade-in">
              {/* Header Title */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <h2 className="text-sm font-black tracking-wider text-slate-100 font-display uppercase">Secured Cloud Sync</h2>
                  <p className="text-[10px] text-slate-500 uppercase font-mono">Personal vehicle database portal</p>
                </div>
                <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-full text-[10px] font-mono">
                  <span className={`w-1.5 h-1.5 rounded-full ${currentUser ? "bg-emerald-500 animate-pulse" : isSupabaseConfigured() ? "bg-blue-500 animate-pulse" : "bg-amber-500 animate-pulse"}`}></span>
                  <span className={currentUser ? "text-emerald-400 font-bold" : isSupabaseConfigured() ? "text-blue-400 font-bold" : "text-amber-400 font-bold"}>
                    {currentUser ? "User Session Active" : isSupabaseConfigured() ? "Cloud Active" : "Local-Only"}
                  </span>
                </div>
              </div>

              {!currentUser ? (
                /* CASE: USER LOGGED OUT - show custom credentials sign in or sign up or OTP */
                <div className="space-y-6">
                  
                  {/* Authenticate form core */}
                  <div className="p-5 bg-slate-900/60 rounded-2xl border border-slate-850 space-y-5 font-sans relative">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/25 text-indigo-400`}>
                        <Lock className="h-4 w-4" />
                      </div>
                      <div>
                        <h3 className="text-xs font-black uppercase text-slate-200 tracking-wider font-mono">
                          {authFormMode === 'signin' ? "Sign In to Account" : authFormMode === 'signup' ? "Create New Account" : "Activate Your Email"}
                        </h3>
                        <p className="text-[10.5px] text-slate-400 leading-normal mt-0.5 font-light">
                          {authFormMode === 'signin' 
                            ? "Sign in with your username or email and password to sync your cars." 
                            : authFormMode === 'signup' 
                            ? "Create an account with a unique username, email, and password." 
                            : "Enter the verification code sent to your email (Required on first login)."}
                        </p>
                      </div>
                    </div>

                    {/* Status Notices */}
                    {authMessage && (
                      <div className="p-3 bg-emerald-950/40 border border-emerald-500/20 rounded-xl text-emerald-400 text-[10.5px] leading-relaxed flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
                        <span>{authMessage}</span>
                      </div>
                    )}

                    {authErrorInput && (
                      <div className="p-3 bg-red-950/40 border border-red-500/20 rounded-xl text-red-100 text-[10.5px] leading-relaxed flex items-start gap-2 font-mono">
                        <ShieldAlert className="h-4 w-4 shrink-0 text-red-400 mt-0.5" />
                        <span>{authErrorInput}</span>
                      </div>
                    )}

                    {authFormMode === 'signin' && (
                      /* Sign In Mode */
                      <form onSubmit={handleCustomLogin} className="space-y-3 pt-1">
                        <div className="space-y-1.5">
                          <label className="text-[9px] font-bold font-mono uppercase text-slate-500 block">Username or Email Address</label>
                          <div className="relative">
                            <User className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-600" />
                            <input
                              type="text"
                              required
                              disabled={authLoading}
                              placeholder="e.g. drift_king or user@example.com"
                              value={authEmail}
                              onChange={(e) => setAuthEmail(e.target.value)}
                              className="w-full bg-slate-950 border border-slate-850 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-red-500/55 transition font-mono"
                            />
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[9px] font-bold font-mono uppercase text-slate-500 block">Password</label>
                          <div className="relative">
                            <Lock className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-600" />
                            <input
                              type="password"
                              required
                              disabled={authLoading}
                              placeholder="••••••••"
                              value={authPassword}
                              onChange={(e) => setAuthPassword(e.target.value)}
                              className="w-full bg-slate-950 border border-slate-850 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-red-500/55 transition font-mono"
                            />
                          </div>
                        </div>

                        <button
                          type="submit"
                          disabled={authLoading}
                          className={`w-full text-xs font-bold font-mono uppercase py-2.5 rounded-lg cursor-pointer flex items-center justify-center gap-2 text-white bg-red-650 hover:bg-red-600 transition`}
                        >
                          {authLoading ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              <span>Authenticating Session...</span>
                            </>
                          ) : (
                            "Verify Credentials & Sign In"
                          )}
                        </button>

                        <div className="text-center pt-2">
                          <button
                            type="button"
                            onClick={() => {
                              setAuthFormMode('signup');
                              setAuthEmail("");
                              setAuthPassword("");
                              setAuthConfirmPassword("");
                              setAuthErrorInput(null);
                              setAuthMessage(null);
                            }}
                            className="text-[10px] text-red-400 hover:underline font-mono uppercase tracking-wider"
                          >
                            Don't have an account? Sign Up instead
                          </button>
                        </div>
                      </form>
                    )}

                    {authFormMode === 'signup' && (
                      /* Signup Mode */
                      <form onSubmit={handleCustomSignup} className="space-y-3 pt-1">
                        <div className="space-y-1.5">
                          <label className="text-[9px] font-bold font-mono uppercase text-slate-500 block">Choose Username</label>
                          <div className="relative">
                            <User className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-600" />
                            <input
                              type="text"
                              required
                              disabled={authLoading}
                              placeholder="e.g. drift_king"
                              value={authUsername}
                              onChange={(e) => setAuthUsername(e.target.value)}
                              className="w-full bg-slate-950 border border-slate-850 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-red-500/55 transition font-mono"
                            />
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[9px] font-bold font-mono uppercase text-slate-500 block">Your Email Address</label>
                          <div className="relative">
                            <Mail className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-600" />
                            <input
                              type="email"
                              required
                              disabled={authLoading}
                              placeholder="user@example.com"
                              value={authEmail}
                              onChange={(e) => setAuthEmail(e.target.value)}
                              className="w-full bg-slate-950 border border-slate-850 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-red-500/55 transition font-mono"
                            />
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[9px] font-bold font-mono uppercase text-slate-500 block">Password</label>
                          <div className="relative">
                            <Lock className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-600" />
                            <input
                              type="password"
                              required
                              disabled={authLoading}
                              placeholder="Minimum 6 characters"
                              value={authPassword}
                              onChange={(e) => setAuthPassword(e.target.value)}
                              className="w-full bg-slate-950 border border-slate-850 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-red-500/55 transition font-mono"
                            />
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[9px] font-bold font-mono uppercase text-slate-500 block">Confirm Password</label>
                          <div className="relative">
                            <Lock className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-600" />
                            <input
                              type="password"
                              required
                              disabled={authLoading}
                              placeholder="Repeat password"
                              value={authConfirmPassword}
                              onChange={(e) => setAuthConfirmPassword(e.target.value)}
                              className="w-full bg-slate-950 border border-slate-850 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-red-500/55 transition font-mono"
                            />
                          </div>
                        </div>

                        <button
                          type="submit"
                          disabled={authLoading}
                          className="w-full text-xs font-bold font-mono uppercase py-2.5 rounded-lg cursor-pointer flex items-center justify-center gap-2 text-white bg-red-650 hover:bg-red-600 transition"
                        >
                          {authLoading ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              <span>Registering Account Database...</span>
                            </>
                          ) : (
                            "Create Secure Account"
                          )}
                        </button>

                        <div className="text-center pt-2">
                          <button
                            type="button"
                            onClick={() => {
                              setAuthFormMode('signin');
                              setAuthEmail("");
                              setAuthPassword("");
                              setAuthConfirmPassword("");
                              setAuthErrorInput(null);
                              setAuthMessage(null);
                            }}
                            className="text-[10px] text-red-400 hover:underline font-mono uppercase tracking-wider"
                          >
                            Already have an account? Sign In
                          </button>
                        </div>
                      </form>
                    )}

                    {authFormMode === 'otp_verify' && (
                      /* First Time Login Verification Mode */
                      <form onSubmit={handleCustomVerifyOtp} className="space-y-3 pt-1">
                        <div className="p-3.5 bg-yellow-500/5 border border-yellow-500/15 rounded-xl space-y-1.5">
                          <h4 className="text-[10px] font-bold text-yellow-500 uppercase font-mono tracking-wider flex items-center gap-1">⚠️ Email Verification Required</h4>
                          <p className="text-[9.5px] text-zinc-400 leading-relaxed font-sans">
                            Since this is your first time logging in, you must verify your email address to active your cloud synchronizer.
                          </p>
                        </div>



                        <div className="space-y-1.5">
                          <div className="flex justify-between items-center">
                            <label className="text-[9px] font-bold font-mono uppercase text-slate-500 block">Enter 6-Digit OTP</label>
                            <span className="text-[9px] text-zinc-400 font-mono font-medium">{authEmail}</span>
                          </div>
                          <input
                            type="text"
                            required
                            disabled={authLoading}
                            placeholder="e.g. 123456"
                            value={authOtpCode}
                            onChange={(e) => setAuthOtpCode(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-center text-xs text-slate-200 focus:outline-none focus:border-red-500/55 transition font-mono tracking-widest font-black"
                          />
                        </div>

                        <div className="flex gap-2.5 pt-1">
                          <button
                            type="button"
                            disabled={authLoading}
                            onClick={() => {
                              setAuthFormMode('signin');
                              setAuthOtpCode("");
                              setAuthPassword("");
                              setAuthErrorInput(null);
                              setAuthMessage(null);
                            }}
                            className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-705 text-slate-300 font-bold font-mono uppercase text-[10px] cursor-pointer transition"
                          >
                            Back to Sign In
                          </button>
                          
                          <button
                            type="submit"
                            disabled={authLoading}
                            className={`flex-1 text-xs font-bold font-mono uppercase py-2 rounded-lg cursor-pointer flex items-center justify-center gap-2 text-white bg-emerald-600 hover:bg-emerald-500 transition`}
                          >
                            {authLoading ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              "Verify Code & Login"
                            )}
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={handleCustomResendOtp}
                          disabled={authLoading}
                          className="w-full text-center text-[9px] font-mono text-slate-400 hover:text-red-400 hover:underline uppercase tracking-widest pt-1 cursor-pointer"
                        >
                          Didn't receive code? Generate New OTP
                        </button>
                      </form>
                    )}

                  </div>

                  {/* Informational tip */}
                  <div className="p-3.5 bg-slate-900/40 border border-slate-850 rounded-xl text-center font-sans space-y-1">
                    <p className="font-bold text-slate-300 uppercase font-mono text-[9px]">Live Database Connection</p>
                    <p className="text-[10px] text-zinc-400 leading-normal">
                      Create an account or sign in to enable real-time persistent synchronization.
                    </p>
                  </div>
                </div>
              ) : (
                /* CASE: USER LOGGED IN - display user metrics card */
                <div className="space-y-4 font-sans">
                  <div className="p-5 bg-gradient-to-br from-slate-900 to-zinc-950 border border-slate-850 rounded-2xl shadow-lg relative overflow-hidden space-y-5">
                    
                    {/* Background decor */}
                    <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 rounded-full blur-2xl pointer-events-none"></div>
                    
                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shrink-0`}>
                        <User className="h-6 w-6" />
                      </div>
                      <div className="space-y-0.5 min-w-0 flex-1">
                        <span className="text-[9px] font-extrabold font-mono tracking-widest text-emerald-400 uppercase">Registered Session</span>
                        <h4 className="text-xs font-bold text-slate-200 truncate">{currentUser.username || currentUser.email}</h4>
                        <p className="text-[9.5px] text-zinc-500 font-mono uppercase truncate">
                          Email: {currentUser.email}
                        </p>
                      </div>
                    </div>

                    {/* Database Status log details */}
                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-850/60 flex flex-col gap-2 text-[10.5px] font-mono leading-relaxed">
                      <div className="flex justify-between items-center pb-2 border-b border-slate-900">
                        <span className="text-slate-500 text-[10px] uppercase">My Personal Garage Scans:</span>
                        <strong className={`${activeTheme.primaryText} font-extrabold text-xs`}>{garage.length} units</strong>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 text-[10px] uppercase">Transmission Engine:</span>
                        <span className="text-emerald-400 font-bold uppercase text-[10px]">Cloud Active // User-bound</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 text-[10px] uppercase">Database Sync Mode:</span>
                        <span className="text-emerald-400 font-black tracking-widest text-[10px] uppercase">Active</span>
                      </div>
                    </div>

                    {/* Interactive operations row */}
                    <div className="flex flex-col gap-2.5 pt-1">
                      <button
                        onClick={() => {
                          if (currentUser.id) syncCustomUserGarage(currentUser.id);
                        }}
                        disabled={isSupabaseSyncing}
                        className={`w-full bg-slate-800 hover:bg-slate-752 text-slate-200 border border-slate-700/60 font-mono font-bold uppercase text-xs py-2 rounded-xl transition cursor-pointer flex items-center justify-center gap-2`}
                      >
                        <RefreshCw className={`h-3.5 w-3.5 ${isSupabaseSyncing ? "animate-spin" : ""}`} />
                        <span>{isSupabaseSyncing ? "Force Syncing database..." : "Force Account Sync"}</span>
                      </button>

                      <button
                        onClick={handleUserLogout}
                        disabled={authLoading}
                        className={`w-full bg-red-950/20 hover:bg-red-950/40 text-red-500/90 border border-red-900/40 font-mono font-bold uppercase text-xs py-2 rounded-xl transition cursor-pointer flex items-center justify-center gap-2`}
                      >
                        <LogOut className="h-3.5 w-3.5" />
                        <span>Sign Out of Personal Account</span>
                      </button>

                      {accountSyncProgress && (
                        <div className="p-3.5 bg-emerald-950/20 border border-emerald-500/20 text-emerald-400 text-[10.5px] leading-relaxed rounded-xl font-mono mt-1 text-center select-none">
                          <span>{accountSyncProgress}</span>
                        </div>
                      )}

                      {accountSyncError && (
                        <div className="p-3.5 bg-red-950/20 border border-red-500/20 text-red-100 text-[10.5px] leading-relaxed rounded-xl font-mono mt-1 text-center select-none">
                          <span className="text-red-400 font-bold block uppercase text-[9px] tracking-wider mb-0.5">⚠️ Sync Error</span>
                          <span>{accountSyncError}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Supabase SQL Database Migration Assistance Panel */}
              <div className="p-5 bg-gradient-to-br from-[#0c0d12] via-slate-950 to-zinc-950 border border-slate-850 rounded-2xl shadow-lg relative overflow-hidden space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-teal-500/10 border border-teal-500/20 text-teal-400">
                      <Database className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-black uppercase text-slate-200 tracking-wider font-mono">Supabase SQL Schema Setup</h3>
                      <p className="text-[10px] text-zinc-500 uppercase font-mono mt-0.5">Database tables, comments, and RLS policies</p>
                    </div>
                  </div>
                </div>

                <p className="text-[10px] text-zinc-400 font-sans leading-relaxed">
                  To sync scanned cars and live comments with your personal Supabase database, run the SQL script below inside your Supabase dashboard’s **SQL Editor**. This will automatically build the <code className="text-teal-400 bg-slate-900 px-1.5 py-0.5 rounded text-[9.5px]">vehicles</code> and <code className="text-teal-400 bg-slate-900 px-1.5 py-0.5 rounded text-[9.5px]">comments</code> tables and apply required Row Level Security.
                </p>

                <div className="space-y-3">
                  {/* Premium SQL Mode Toggle Tabs */}
                  <div className="flex bg-slate-900/90 border border-slate-800 rounded-xl p-1 w-full font-mono text-[9px] leading-tight shadow-inner">
                    <button
                      type="button"
                      onClick={() => setSqlSchemaMode('create')}
                      className={`flex-1 py-1.5 px-2.5 rounded-lg font-bold transition duration-200 cursor-pointer text-center select-none ${
                        sqlSchemaMode === 'create'
                          ? 'bg-teal-500/20 text-teal-300 border border-teal-500/25 shadow-sm'
                          : 'text-slate-400 hover:text-slate-200 border border-transparent'
                      }`}
                    >
                      🚀 PRISTINE SETUP (NEW TABLES)
                    </button>
                    <button
                      type="button"
                      onClick={() => setSqlSchemaMode('upgrade')}
                      className={`flex-1 py-1.5 px-2.5 rounded-lg font-bold transition duration-200 cursor-pointer text-center select-none ${
                        sqlSchemaMode === 'upgrade'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/25 shadow-sm'
                          : 'text-slate-400 hover:text-slate-200 border border-transparent'
                      }`}
                    >
                      ⚡ UPGRADE TABLES (ADD COLUMN)
                    </button>
                  </div>

                  <button
                    onClick={handleCopySql}
                    className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-teal-500/10 hover:bg-teal-600/20 border border-teal-500/35 hover:border-teal-500/60 font-mono text-[10px] font-bold text-teal-400 hover:text-white transition cursor-pointer active:scale-[0.99]"
                  >
                    {copiedSql ? (
                      <>
                        <Check className="h-4 w-4 text-emerald-400" />
                        <span>SQL SCHEMA COPIED TO CLIPBOARD</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" />
                        <span>{sqlSchemaMode === 'create' ? "COPY COMPLETE DB SQL SCHEMA" : "COPY TABLE UPGRADE / ALTER SQL"}</span>
                      </>
                    )}
                  </button>

                  <div className="bg-slate-950/90 rounded-xl border border-slate-855 p-3 overflow-hidden text-left relative group">
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="text-[9px] text-slate-500 font-mono bg-slate-900 py-0.5 px-1.5 rounded uppercase">Preview</span>
                    </div>
                    <pre className="text-[9px] text-slate-400 font-mono max-h-40 overflow-y-auto leading-relaxed select-all">
{sqlSchemaMode === 'create' ? `-- Create WhipCheck saved vehicles table on Supabase
create table public.vehicles (
  id text primary key,
  timestamp text not null,
  image text not null,
  "isCar" boolean default true,
  make text,
  model text,
  -- ... (click Copy to get full script)
);

-- Create comments table on Supabase
create table public.comments (
  id text primary key,
  car_id text not null,
  author text not null,
  text text not null,
  timestamp text,
  comfort integer,
  "gasConsumption" integer,
  performance integer,
  reliability integer,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);` : `-- Upgrade existing tables to match latest database version
-- Run this block in your Supabase SQL Editor to resolve user_id cache warnings:

alter table public.vehicles add column if not exists user_id text;

-- Enforces Row Level Security constraints safely
alter table public.vehicles enable row level security;
alter table public.comments enable row level security;`}
                    </pre>
                  </div>
                </div>
              </div>

              {/* Developer Workspace & Database Tools Panel */}
              <div className="p-5 bg-gradient-to-br from-[#0c0d12] via-slate-950 to-zinc-950 border border-slate-850 rounded-2xl shadow-lg relative overflow-hidden space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-400">
                      <Settings className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-black uppercase text-slate-200 tracking-wider font-mono">Developer Workspace & Live Sync</h3>
                      <p className="text-[10px] text-zinc-500 uppercase font-mono mt-0.5">Supabase credentials override & server purge tools</p>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase ${
                    isSupabaseConfigured() ? "bg-emerald-950/40 text-emerald-400 border border-emerald-500/20" : "bg-amber-950/40 text-amber-500 border border-amber-500/20"
                  }`}>
                    {isSupabaseConfigured() ? "Supabase Configured" : "Local Database Mode"}
                  </span>
                </div>

                <p className="text-[10px] text-zinc-400 font-sans leading-relaxed">
                  Override the application's global Supabase connection at runtime. Enter your Supabase details below to write scans directly to your live tables.
                </p>

                {/* Database parameter fields */}
                <div className="space-y-3 pt-1">
                  <div className="space-y-1.25">
                    <label className="text-[9px] font-bold font-mono uppercase text-slate-500 block">Supabase Project URL</label>
                    <input
                      type="text"
                      placeholder="https://your-proj-id.supabase.co"
                      value={customSupabaseUrl}
                      onChange={(e) => setCustomSupabaseUrl(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-red-500/55 transition font-mono focus:ring-1 focus:ring-red-500/30"
                    />
                  </div>

                  <div className="space-y-1.25">
                    <label className="text-[9px] font-bold font-mono uppercase text-slate-500 block">Supabase Service Key (Anon Key)</label>
                    <input
                      type="password"
                      placeholder="eyJh... (your public anonymous key)"
                      value={customSupabaseAnonKey}
                      onChange={(e) => setCustomSupabaseAnonKey(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-red-500/55 transition font-mono focus:ring-1 focus:ring-red-500/30"
                    />
                  </div>

                  <div className="flex gap-2.5 pt-0.5">
                    <button
                      type="button"
                      onClick={handleResetParameters}
                      className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-850 text-slate-400 font-bold font-mono uppercase text-[10px] cursor-pointer transition flex items-center gap-1.5"
                    >
                      Reset Defaults
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveParameters}
                      className="flex-1 text-[10.5px] font-bold font-mono uppercase py-2 rounded-lg cursor-pointer flex items-center justify-center gap-1.5 text-white bg-red-650 hover:bg-red-600 transition"
                    >
                      Apply & Connect Credentials
                    </button>
                  </div>
                </div>

                {/* Save Feedback notice */}
                {paramFeedback && (
                  <div className="p-3 bg-indigo-950/40 border border-indigo-500/25 rounded-xl text-indigo-300 text-[10px] leading-relaxed font-mono">
                    {paramFeedback}
                  </div>
                )}

                {/* Sub-section: Force Sync Local Cars to Supabase DB tables */}
                <div className="pt-2 border-t border-slate-900 space-y-3">
                  <div className="space-y-1">
                    <h4 className="text-[10px] font-bold text-slate-300 uppercase font-mono">⚡ Supabase Direct Sync Operations</h4>
                    <p className="text-[9.5px] text-zinc-500">Send your current local scans and offline garage data directly into the active Supabase <code className="text-zinc-400 bg-slate-900 px-1 rounded text-[9px]">vehicles</code> database table.</p>
                  </div>

                  <button
                    onClick={handleManualSync}
                    disabled={isSupabaseSyncing || !isSupabaseConfigured()}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-amber-500/10 hover:bg-amber-600/20 disabled:bg-slate-900 disabled:opacity-40 border border-amber-500/35 hover:border-amber-500/60 disabled:border-slate-800 font-mono text-[10.5px] font-bold text-amber-400 disabled:text-zinc-600 hover:text-white transition cursor-pointer active:scale-[0.99]"
                  >
                    {isSupabaseSyncing ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>SYNCHRONIZING SECURE TRANSFERS...</span>
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4" />
                        <span>FORCE-SYNC LOCAL SCANS TO SUPABASE DB</span>
                      </>
                    )}
                  </button>

                  {/* Sync status logging monitor */}
                  {syncProgress && (
                    <div className="bg-slate-950 border border-slate-900 rounded-xl p-3 overflow-hidden text-left relative">
                      <span className="text-[8.5px] text-amber-500 font-mono font-bold uppercase block tracking-wider mb-1.5">⚡ LIVE BACKUP STATUS LOG</span>
                      <p className="text-[9.5px] text-zinc-300 font-mono leading-relaxed whitespace-pre-wrap select-all">
                        {syncProgress}
                      </p>
                    </div>
                  )}
                </div>

                {/* Sub-section: Local server files purge */}
                <div className="pt-3 border-t border-slate-900 space-y-3">
                  <div className="space-y-1">
                    <h4 className="text-[10px] font-bold text-rose-500 uppercase font-mono">⚠️ Node Server Hard Reset Tools</h4>
                    <p className="text-[9.5px] text-zinc-500">Purge local user databases (<code className="text-zinc-400 bg-slate-900 px-1 rounded text-[9px]">users_db.json</code> & <code className="text-zinc-400 bg-slate-900 px-1 rounded text-[9px]">user_vehicles_db.json</code>) on the hosting server. This wipes user accounts and forces a fresh signup OTP test.</p>
                  </div>

                  {!showWipeConfirm ? (
                    <button
                      onClick={() => setShowWipeConfirm(true)}
                      className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-red-950/20 hover:bg-red-950/40 border border-red-900/40 hover:border-red-800/60 font-mono text-[10.5px] font-bold text-red-400 hover:text-red-200 transition cursor-pointer active:scale-[0.99]"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span>WIPE SERVER FILES & RESTART OTP SIGNUP</span>
                    </button>
                  ) : (
                    <div className="p-3 bg-red-950/30 border border-red-500/35 rounded-xl space-y-2.5">
                      <p className="text-[10px] text-red-200 font-black uppercase font-mono tracking-wider">
                        ⚠️ ARE YOU ABSOLUTELY SURE?
                      </p>
                      <p className="text-[9.5px] text-zinc-400 font-sans leading-normal">
                        This permanently deletes all user accounts, vehicle scans, and comments from the node-server database files. There is absolutely no undo.
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => setShowWipeConfirm(false)}
                          className="py-1.5 px-3 rounded-lg bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-400 font-mono font-bold text-[9.5px] uppercase cursor-pointer transition text-center"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleHardResetServerDatabases}
                          className="py-1.5 px-3 rounded-lg bg-red-600 hover:bg-red-500 text-white font-mono font-black text-[9.5px] uppercase cursor-pointer transition text-center shadow-md shadow-red-950/50"
                        >
                          YES, PURGE EVERYTHING
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Purge status logging monitor */}
                  {resetFeedback && (
                    <div className="p-3 bg-red-950/30 border border-red-900/30 rounded-xl text-red-300 text-[10px] leading-relaxed font-mono">
                      {resetFeedback}
                    </div>
                  )}
                </div>
              </div>

            </div>
          )}


        </main>

        {/* FLOATING VEHICLE COMPARISON DRAWER */}
        {compareList.length > 0 && !showCompareActive && (
          <div className="fixed bottom-20 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-slate-900/95 backdrop-blur-md rounded-2xl border border-amber-500/25 p-3 shadow-2xl flex items-center justify-between gap-4 z-50 animate-fade-in shadow-amber-500/5">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/20 shrink-0 flex items-center justify-center animate-pulse">
                <Scale className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h5 className="text-[10px] font-bold text-slate-100 uppercase font-mono tracking-wide">Dynamic Spec Matchup ({compareList.length}/3)</h5>
                <p className="text-[11px] font-semibold text-amber-400 truncate mt-0.5 font-sans leading-none">
                  {compareList.map(c => c.make).join(" vs ")}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => setCompareList([])}
                className="text-[10px] text-zinc-400 hover:text-slate-100 font-bold px-2.5 py-1.5 rounded-lg border border-slate-850 bg-slate-950 font-mono transition cursor-pointer"
              >
                Clear
              </button>
              <button
                onClick={() => {
                  setShowCompareActive(true);
                  setSelectedGarageCar(null);
                  setActiveTab('garage');
                }}
                className="text-[10px] text-slate-950 bg-amber-400 hover:bg-amber-500 font-bold px-3 py-1.5 rounded-lg font-mono transition shadow-lg shrink-0 cursor-pointer"
              >
                Compare Now
              </button>
            </div>
          </div>
        )}

        {/* FUTURISTIC PREMIUM MOBILE NAVIGATION BAR (Matches High Density styling) */}
        <footer className="mt-auto bg-black/95 backdrop-blur-md border-t border-slate-850 p-3 shrink-0 relative z-20">
          <div className="flex justify-around items-center max-w-md mx-auto">
            
            {/* Nav item 2 (Center Big Button) */}
            <button
              onClick={() => { setActiveTab('scan'); setSelectedGarageCar(null); }}
              className={`flex flex-col items-center gap-1 transition-all cursor-pointer -translate-y-2`}
            >
              <div className={`w-12 h-12 rounded-full border-2 transition-all flex items-center justify-center ${
                activeTab === 'scan' 
                  ? `border-white bg-[#0e0f14]` 
                  : 'border-slate-700 bg-slate-900 group-hover:border-slate-500'
              }`}
              style={activeTab === 'scan' ? { borderColor: activeTheme.colorHex, boxShadow: `0 0 15px ${activeTheme.colorHex}60` } : undefined}
              >
                <CameraIcon className={`h-5 w-5 ${activeTab === 'scan' ? activeTheme.primaryText : 'text-slate-400'}`} />
              </div>
              <span className={`text-[9px] font-mono uppercase tracking-widest font-bold -mt-1 ${activeTab === 'scan' ? activeTheme.primaryText : 'text-slate-500'}`}>
                Scan
              </span>
            </button>

            {/* Nav item 3 */}
            <button
              onClick={() => { setActiveTab('garage'); setSelectedGarageCar(null); }}
              className={`flex flex-col items-center gap-1 transition-all cursor-pointer ${activeTab === 'garage' ? `${activeTheme.accentText} opacity-100 scale-105` : 'text-slate-500 hover:text-slate-200'}`}
            >
              <div className={`p-1.5 rounded-full border transition-colors ${activeTab === 'garage' ? `${activeTheme.accentBorder} bg-white/5` : 'border-transparent'}`}>
                <Database className="h-4 w-4" />
              </div>
              <span className="text-[9px] font-mono uppercase tracking-widest font-semibold">Garage</span>
            </button>

            {/* Nav item 4 (Account) */}
            <button
              onClick={() => { setActiveTab('account'); setSelectedGarageCar(null); }}
              className={`flex flex-col items-center gap-1 transition-all cursor-pointer ${activeTab === 'account' ? `${activeTheme.accentText} opacity-100 scale-105` : 'text-slate-500 hover:text-slate-200'}`}
            >
              <div className={`p-1.5 rounded-full border transition-colors ${activeTab === 'account' ? `${activeTheme.accentBorder} bg-white/5` : 'border-transparent'}`}>
                <User className="h-4 w-4" />
              </div>
              <span className="text-[9px] font-mono uppercase tracking-widest font-semibold">Account</span>
            </button>

          </div>
        </footer>


      </div>
    </div>
  );
}
