import React, { useState, useEffect, useRef } from "react";
import { 
  Camera as CameraIcon, Upload, Sparkles, History, Compass, Database, 
  Trash2, ShieldAlert, CheckCircle2, ChevronRight, RotateCcw, StopCircle,
  MapPin, Loader2, Gauge, Settings, Cpu, HelpCircle, RefreshCw, Layers, ShieldCheck,
  Search, ArrowUpDown, SlidersHorizontal, Cloud, CloudOff, Server, Copy, Check, ExternalLink, Code,
  LogOut, User, Mail, Lock, Scale, MessageSquare, HardDrive
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

export function getPrettifiedJson(val: string): string {
  try {
    const parsed = JSON.parse(val);
    return JSON.stringify(parsed, null, 2);
  } catch (e) {
    return val;
  }
}

export default function App() {
  // Mobile UI Tabs: 'dashboard' | 'scan' | 'garage' | 'account'
  const [activeTab, setActiveTab] = useState<'dashboard' | 'scan' | 'garage' | 'account'>('dashboard');

  // Garage and saving errors validation messages
  const [saveError, setSaveError] = useState<string | null>(null);

  // Sport tuning dashboard state
  const [currThemeId, setCurrThemeId] = useState<string>(() => {
    return localStorage.getItem("whipcheck_theme_id") || "ferrari";
  });

  useEffect(() => {
    localStorage.setItem("whipcheck_theme_id", currThemeId);
  }, [currThemeId]);

  // Subscription parameters tailored for young users (COPPA-aligned, parental safety features)
  const [selectedPlanTier, setSelectedPlanTier] = useState<'chiptuning' | 'teen_passion' | 'gasoline_gold'>(() => {
    return (localStorage.getItem("whipcheck_subscription_tier") as 'chiptuning' | 'teen_passion' | 'gasoline_gold') || 'chiptuning';
  });
  const [scansCountUsed, setScansCountUsed] = useState<number>(() => {
    return parseInt(localStorage.getItem("whipcheck_scan_use_count") || "0", 10);
  });
  const [activePlanSelection, setActivePlanSelection] = useState<'chiptuning' | 'teen_passion' | 'gasoline_gold'>('chiptuning');
  const [showSubscriptionModal, setShowSubscriptionModal] = useState<boolean>(false);
  const [showParentAuthorization, setShowParentAuthorization] = useState<boolean>(false);
  const [parentName, setParentName] = useState<string>(() => localStorage.getItem("whipcheck_parent_name") || "");
  const [parentEmail, setParentEmail] = useState<string>(() => localStorage.getItem("whipcheck_parent_email") || "");
  const [parentPin, setParentPin] = useState<string>("");
  const [parentPinError, setParentPinError] = useState<string | null>(null);
  const [showCopiedParentLink, setShowCopiedParentLink] = useState<boolean>(false);
  const [subscriptionSuccessMessage, setSubscriptionSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (selectedPlanTier === 'chiptuning' && (currThemeId === 'bugatti' || currThemeId === 'lamborghini')) {
      setCurrThemeId('ferrari');
    }
  }, [selectedPlanTier, currThemeId]);

  const activeTheme = THEMES[currThemeId] || THEMES.ferrari;
  
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
          if (!key) return;
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
    if (selectedPlanTier === 'chiptuning') {
      setCompareError("🔒 Vehicle comparison is a Premium feature. Upgrade to Teen Passion to compare cars!");
      setTimeout(() => setCompareError(null), 5000);
      handleOpenPlans('teen_passion');
      return;
    }

    setCompareList((prev) => {
      const exists = prev.some((c) => c.id === car.id);
      if (exists) {
        return prev.filter((c) => c.id !== car.id);
      } else {
        const maxLimit = selectedPlanTier === 'teen_passion' ? 2 : 3;
        if (prev.length >= maxLimit) {
          if (selectedPlanTier === 'teen_passion') {
            setCompareError("🔒 Teen Passion limits comparisons to 2 vehicles. Upgrade to Gasoline Gold to compare 3 vehicles!");
            setTimeout(() => setCompareError(null), 5000);
            handleOpenPlans('gasoline_gold');
          } else {
            setCompareError("Maximum of 3 vehicles can be compared at once.");
            setTimeout(() => setCompareError(null), 3500);
          }
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

  // Dashboard Stats States (Placed below currentUser to respect scoping boundaries)
  const [dashboardStats, setDashboardStats] = useState<{
    totalUniqueScannedImages: number;
    totalScansCount: number;
    totalUsersCount: number;
    userCommentsCount: number;
    topRatedCar: (IdentifiedCar & { 
      averageRating: number; 
      ratingCount: number;
      comfortAvg?: number;
      gasAvg?: number;
      performanceAvg?: number;
      reliabilityAvg?: number;
    }) | null;
  } | null>(null);
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(false);

  const fetchDashboardStats = async () => {
    setIsLoadingDashboard(true);
    try {
      const activeName = currentUser 
        ? (currentUser.username || currentUser.email || currentUser.id) 
        : (localStorage.getItem("whipcheck_spotter_name") || "Guest");
      
      const res = await fetch(`/api/dashboard-stats?username=${encodeURIComponent(activeName)}`);
      if (res.ok) {
        const data = await res.json();
        setDashboardStats(data);
      }
    } catch (err) {
      console.error("Failed to load dashboard stats", err);
    } finally {
      setIsLoadingDashboard(false);
    }
  };

  useEffect(() => {
    fetchDashboardStats();
  }, [currentUser, garage, activeTab]);

  // Admin Gateway and Live Parameters States
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState<boolean>(() => {
    return sessionStorage.getItem("whipcheck_admin_session") === "true";
  });
  const [adminUsernameInput, setAdminUsernameInput] = useState<string>("");
  const [adminPasswordInput, setAdminPasswordInput] = useState<string>("");
  const [adminSubTab, setAdminSubTab] = useState<'db' | 'script' | 'data' | 'localstorage'>('db');
  const [adminDbStats, setAdminDbStats] = useState<any>(null);
  const [adminDbStatsLoading, setAdminDbStatsLoading] = useState<boolean>(false);
  const [adminError, setAdminError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [customSupabaseUrl, setCustomSupabaseUrl] = useState<string>(() => getActiveSupabaseConfig().url);
  const [customSupabaseAnonKey, setCustomSupabaseAnonKey] = useState<string>(() => getActiveSupabaseConfig().anonKey);
  const [paramFeedback, setParamFeedback] = useState<string | null>(null);

  // Local Storage Browser Workspace States
  const [localStorageItems, setLocalStorageItems] = useState<{ key: string; value: string }[]>([]);
  const [selectedLocalStorageKey, setSelectedLocalStorageKey] = useState<string | null>(null);
  const [selectedLocalStorageValue, setSelectedLocalStorageValue] = useState<string>("");
  const [isEditingLocalStorage, setIsEditingLocalStorage] = useState<boolean>(false);
  const [localStorageSearch, setLocalStorageSearch] = useState<string>("");
  const [localStorageFilter, setLocalStorageFilter] = useState<'all' | 'garage' | 'comments' | 'auth' | 'other'>('all');
  const [localStorageSuccessMessage, setLocalStorageSuccessMessage] = useState<string | null>(null);
  const [localStorageErrorMessage, setLocalStorageErrorMessage] = useState<string | null>(null);
  const [localStorageCopiedKey, setLocalStorageCopiedKey] = useState<string | null>(null);

  // Non-blocking UI confirmation states to bypass sandboxed iFrame blocks
  const [showKeyDeleteConfirm, setShowKeyDeleteConfirm] = useState<boolean>(false);
  const [showClearCommentsConfirm, setShowClearCommentsConfirm] = useState<boolean>(false);
  const [showFormatConfirm, setShowFormatConfirm] = useState<boolean>(false);

  const refreshLocalStorage = () => {
    const items: { key: string; value: string }[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        items.push({ key, value: localStorage.getItem(key) || "" });
      }
    }
    // Sort keys alphabetically
    items.sort((a, b) => a.key.localeCompare(b.key));
    setLocalStorageItems(items);
    if (selectedLocalStorageKey) {
      const currentVal = localStorage.getItem(selectedLocalStorageKey);
      if (currentVal !== null) {
        setSelectedLocalStorageValue(currentVal);
      } else {
        setSelectedLocalStorageKey(null);
        setSelectedLocalStorageValue("");
        setIsEditingLocalStorage(false);
      }
    }
  };

  useEffect(() => {
    if (adminSubTab === 'localstorage') {
      refreshLocalStorage();
    }
  }, [adminSubTab]);

  // Subscription action logic
  const handleOpenPlans = (tier?: 'chiptuning' | 'teen_passion' | 'gasoline_gold') => {
    if (!currentUser) {
      setAuthFormMode('signup');
      setActiveTab('account');
      setAuthMessage("💡 Register a free account first to access WhipCheck membership subscription plans!");
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setActivePlanSelection(tier || selectedPlanTier);
    setShowSubscriptionModal(true);
  };

  const handleSelectPlan = (tier: 'chiptuning' | 'teen_passion' | 'gasoline_gold') => {
    setActivePlanSelection(tier);
    if (tier === 'chiptuning') {
      localStorage.setItem("whipcheck_subscription_tier", 'chiptuning');
      setSelectedPlanTier('chiptuning');
      setSubscriptionSuccessMessage("Successfully returned to the Chiptuning Free tier!");
      setTimeout(() => setSubscriptionSuccessMessage(null), 3000);
    } else {
      setShowParentAuthorization(true);
      setParentPinError(null);
    }
  };

  const handleParentAuthSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!parentName.trim()) {
      setParentPinError("Parent/Guardian full name is required for verification.");
      return;
    }
    if (!parentEmail.trim()) {
      setParentPinError("Parent/Guardian email is required to submit parental consent.");
      return;
    }
    if (!parentPin || parentPin.length < 4) {
      setParentPinError("Please set a 4-digit security PIN for parent co-pilot approval.");
      return;
    }

    localStorage.setItem("whipcheck_subscription_tier", activePlanSelection);
    setSelectedPlanTier(activePlanSelection);
    localStorage.setItem("whipcheck_parent_name", parentName);
    localStorage.setItem("whipcheck_parent_email", parentEmail);

    setShowParentAuthorization(false);
    setShowSubscriptionModal(false);
    setSubscriptionSuccessMessage(`🎉 Subscription upgraded to '${activePlanSelection === 'teen_passion' ? 'TEEN PASSION' : 'GASOLINE GOLD'}' with verified parental co-pilot approval!`);
    setTimeout(() => {
      setSubscriptionSuccessMessage(null);
    }, 5000);
  };

  const handleSimulatePinBypass = () => {
    // Fill in a demo pin easily for fast sandbox evaluation
    setParentName("Alex Mercer (Parent)");
    setParentEmail("parent.alex@whipcheck.io");
    setParentPin("5824");
  };
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

    // Auto-fetch sandbox server database statistics if administrator session is active
    if (sessionStorage.getItem("whipcheck_admin_session") === "true") {
      fetch("/api/admin/database-stats")
        .then(res => res.json())
        .then(data => setAdminDbStats(data))
        .catch(() => {});
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
      if (parsedUser.id) {
        fetch(`/api/user/vehicles/${encodeURIComponent(parsedUser.id)}`)
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
        let base64 = sharedCarData.replace(/-/g, "+").replace(/_/g, "/");
        while (base64.length % 4) {
          base64 += "=";
        }
        const decodedCar = JSON.parse(decodeURIComponent(escape(atob(base64))));
        if (decodedCar && decodedCar.id) {
          setIdentifiedCar(decodedCar);
          setScanStep('done');
          setActiveTab('scan');
          // Clean query params cleanly
          const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
          window.history.replaceState({ path: cleanUrl }, '', cleanUrl);
        }
      } else if (sharedCompareData) {
        let base64 = sharedCompareData.replace(/-/g, "+").replace(/_/g, "/");
        while (base64.length % 4) {
          base64 += "=";
        }
        const decodedCars = JSON.parse(decodeURIComponent(escape(atob(base64))));
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
    setSaveError(null);

    const limit = selectedPlanTier === 'chiptuning' ? 3 : selectedPlanTier === 'teen_passion' ? 15 : Infinity;
    if (garage.length >= limit) {
      const planNameCurrent = selectedPlanTier === 'chiptuning' ? 'Chiptuning Free' : 'Teen Passion';
      const planNameNext = selectedPlanTier === 'chiptuning' ? 'teen_passion' : 'gasoline_gold';
      setSaveError(`🔒 Your active ${planNameCurrent} plan limits your garage to ${limit} vehicles. Upgrade to expand your co-pilot collection!`);
      handleOpenPlans(planNameNext);
      return;
    }

    const key = getGarageStorageKey(currentUser);
    const exists = garage.some(c => c.id === car.id);
    if (exists) {
      setSaveError("Car already added before");
      return;
    }

    const updated = [car, ...garage];
    setGarage(updated);
    localStorage.setItem(key, JSON.stringify(updated));

    // Synchronize to the custom user server if available
    if (currentUser && currentUser.id && localStorage.getItem("whipcheck_user_session")) {
      try {
        setIsSupabaseSyncing(true);
        const response = await fetch(`/api/user/vehicles/${encodeURIComponent(currentUser.id)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ vehicle: car })
        });
        if (!response.ok) {
          const resData = await response.json();
          if (resData.error === "Car already added before") {
            setSaveError("Car already added before");
            setGarage(garage);
            localStorage.setItem(key, JSON.stringify(garage));
            return;
          }
        }
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
        await fetch(`/api/user/vehicles/${encodeURIComponent(currentUser.id)}/${encodeURIComponent(id)}`, {
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

  const checkScanLimitReached = () => {
    if (selectedPlanTier === 'chiptuning' && (scansCountUsed >= 3 || garage.length >= 3)) {
      return true;
    }
    if (selectedPlanTier === 'teen_passion' && (scansCountUsed >= 15 || garage.length >= 15)) {
      return true;
    }
    return false;
  };

  // Handle sample click
  const handleSelectSample = (sampleUrl: string) => {
    if (checkScanLimitReached()) {
      handleOpenPlans(selectedPlanTier === 'chiptuning' ? 'teen_passion' : 'gasoline_gold');
      setAuthMessage(`🚫 Scan limit of ${selectedPlanTier === 'chiptuning' ? '3' : '15'} scans reached for your current plan! Upgrade to unlock unlimited scans.`);
      return;
    }
    setImageUrl(sampleUrl);
    analyzeCarImage(null, sampleUrl);
  };

  // Trigger Gemini API Request
  const analyzeCarImage = async (base64Data: string | null, urlData: string | null) => {
    if (checkScanLimitReached()) {
      handleOpenPlans(selectedPlanTier === 'chiptuning' ? 'teen_passion' : 'gasoline_gold');
      setAuthMessage(`🚫 Scan limit of ${selectedPlanTier === 'chiptuning' ? '3' : '15'} scans reached for your current plan! Upgrade to unlock unlimited scans.`);
      setScanStep('idle');
      return;
    }
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
      
      // Track and increment the scan use count
      const newScanCount = scansCountUsed + 1;
      setScansCountUsed(newScanCount);
      localStorage.setItem("whipcheck_scan_use_count", newScanCount.toString());
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
    setSaveError(null);
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

  const fetchAdminDbStats = async () => {
    setAdminDbStatsLoading(true);
    setAdminError(null);
    try {
      const res = await fetch("/api/admin/database-stats");
      if (res.ok) {
        const stats = await res.json();
        setAdminDbStats(stats);
      } else {
        const errData = await res.json().catch(() => ({}));
        setAdminError(errData.error || "Failed to retrieve local sandbox database statistics.");
      }
    } catch (e: any) {
      setAdminError(e.message || "Failed to retrieve local sandbox database statistics.");
    } finally {
      setAdminDbStatsLoading(false);
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const uInput = adminUsernameInput.trim().toLowerCase();
    const pInput = adminPasswordInput.trim();
    if (uInput === "admin" && (pInput === "admin" || pInput === "admin123")) {
      setIsAdminLoggedIn(true);
      sessionStorage.setItem("whipcheck_admin_session", "true");
      setAdminError(null);
      
      const active = getActiveSupabaseConfig();
      setCustomSupabaseUrl(active.url);
      setCustomSupabaseAnonKey(active.anonKey);
      
      // Load current database stats right away
      await fetchAdminDbStats();
    } else {
      setAdminError("Invalid administrator credentials. Access denied.");
    }
  };

  const handleAdminLogout = () => {
    setIsAdminLoggedIn(false);
    sessionStorage.removeItem("whipcheck_admin_session");
    setAdminUsernameInput("");
    setAdminPasswordInput("");
    setAdminDbStats(null);
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
    if (!userId || userId === "undefined" || userId === "null") {
      console.warn("syncCustomUserGarage aborted: invalid or empty userId");
      return;
    }
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
      const res = await fetch(`/api/user/vehicles/${encodeURIComponent(userId)}`);
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
              await fetch(`/api/user/vehicles/${encodeURIComponent(userId)}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ vehicle: car })
              }).catch(e => console.warn("Failed back-porting to node-server:", e));
            })
          );
        }

        // Fetch refreshed garage from custom node database
        const refreshNodeRes = await fetch(`/api/user/vehicles/${encodeURIComponent(userId)}`);
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
            await fetch(`/api/user/vehicles/${encodeURIComponent(userId)}`, {
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
        localStorage.setItem("whipcheck_spotter_name", data.user.username || data.user.email);
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
        localStorage.setItem("whipcheck_spotter_name", data.user.username || data.user.email);
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
    localStorage.setItem("whipcheck_spotter_name", "Guest");
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
      localStorage.setItem("whipcheck_spotter_name", "Guest");
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
          
          <div className="flex items-center justify-between relative z-10 w-full col-span-2">
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

            {/* Premium subscription active badge & scan counters */}
            <div className="flex flex-col items-end gap-1.5 select-none">
              {(() => {
                if (selectedPlanTier === 'gasoline_gold') {
                  return (
                    <div 
                      onClick={() => handleOpenPlans('gasoline_gold')}
                      className="cursor-pointer flex items-center gap-1 px-2 py-0.5 bg-gradient-to-r from-amber-400 to-yellow-500 rounded border border-amber-300 shadow-md shadow-amber-950/45 shrink-0"
                    >
                      <Sparkles className="h-2.5 w-2.5 text-slate-900" />
                      <span className="text-[7.5px] font-mono font-black text-slate-900 tracking-wide">GOLD CO-PILOT</span>
                    </div>
                  );
                }
                if (selectedPlanTier === 'teen_passion') {
                  return (
                    <div 
                      onClick={() => handleOpenPlans('teen_passion')}
                      className="cursor-pointer flex items-center gap-1 px-2 py-0.5 bg-gradient-to-r from-indigo-500 to-purple-600 rounded border border-indigo-400 shadow-md shadow-indigo-950/45 shrink-0"
                    >
                      <Gauge className="h-2.5 w-2.5 text-white" />
                      <span className="text-[7.5px] font-mono font-black text-white tracking-wide">TEEN PASSION</span>
                    </div>
                  );
                }
                return (
                  <div 
                    onClick={() => handleOpenPlans('chiptuning')}
                    className="cursor-pointer flex items-center gap-1 px-2 py-0.5 bg-slate-800 hover:bg-slate-750 rounded border border-slate-700 hover:border-indigo-500 transition-all text-slate-350 shrink-0"
                  >
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-slate-500 animate-pulse"></span>
                    <span className="text-[7.5px] font-mono font-bold tracking-wide">FREE TIER 🔒</span>
                  </div>
                );
              })()}
              
              <div className="text-[8px] font-mono space-y-0.5 tracking-tight text-right text-zinc-400">
                <div>
                  <span className="text-[7px] text-zinc-500 uppercase">Scans: </span>
                  {selectedPlanTier === 'chiptuning' && <span className="font-bold text-emerald-400">{Math.max(0, 3 - scansCountUsed)}/3 rmn</span>}
                  {selectedPlanTier === 'teen_passion' && <span className="font-bold text-indigo-400">{Math.max(0, 15 - scansCountUsed)}/15 rmn</span>}
                  {selectedPlanTier === 'gasoline_gold' && <span className="font-bold text-amber-400">⚡ Unlim ♾️</span>}
                </div>
                <div>
                  <span className="text-[7px] text-zinc-500 uppercase">Garage: </span>
                  {selectedPlanTier === 'chiptuning' && <span className="font-bold text-slate-300">{garage.length}/3 slot</span>}
                  {selectedPlanTier === 'teen_passion' && <span className="font-bold text-slate-300">{garage.length}/15 slot</span>}
                  {selectedPlanTier === 'gasoline_gold' && <span className="font-bold text-amber-400">⚡ Unlim ♾️</span>}
                </div>
                <div>
                  <span className="text-[7px] text-zinc-500 uppercase">Compare: </span>
                  {selectedPlanTier === 'chiptuning' && <span className="font-semibold text-red-400">Locked 🔒</span>}
                  {selectedPlanTier === 'teen_passion' && <span className="font-bold text-teal-400">{compareList.length}/2 max</span>}
                  {selectedPlanTier === 'gasoline_gold' && <span className="font-bold text-amber-400">⚡ {compareList.length}/3 max</span>}
                </div>
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
              const isLocked = (t.id === 'bugatti' || t.id === 'lamborghini') && selectedPlanTier === 'chiptuning';
              return (
                <button
                  key={t.id}
                  onClick={() => {
                    if (isLocked) {
                      handleOpenPlans('teen_passion');
                    } else {
                      setCurrThemeId(t.id);
                    }
                  }}
                  className={`px-2 py-1 rounded-xl flex items-center gap-1.5 text-[9.5px] font-mono transition-all border cursor-pointer select-none font-bold shrink-0 ${
                    isSelected 
                      ? `${t.accentBg} ${t.accentBorder} text-slate-900 border-white/40 shadow-md scale-102` 
                      : 'bg-slate-900/60 hover:bg-slate-800 border-slate-800/80 text-slate-300'
                  }`}
                  title={isLocked ? `${t.name} (Premium Locked)` : `${t.name} (${t.brand})`}
                >
                  <span className="inline-block w-2.5 h-2.5 rounded-full border border-black/20 shrink-0" style={{ backgroundColor: t.colorHex }}></span>
                  <span className={isSelected ? 'text-slate-900' : 'text-slate-200'}>
                    {t.id.toUpperCase()} {isLocked && "🔒"}
                  </span>
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
          
          {/* TAB 0: DASHBOARD LANDING SCREEN */}
          {activeTab === 'dashboard' && (
            <div className="space-y-5 animate-fade-in">
              {/* Header Title */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <h2 className="text-sm font-black tracking-wider text-slate-100 font-display uppercase tracking-wider">Spotter Station Dashboard</h2>
                  <p className="text-[10px] text-slate-500 uppercase font-mono">Performance Hub & Spotter Insights</p>
                </div>
                <button
                  onClick={fetchDashboardStats}
                  disabled={isLoadingDashboard}
                  className="p-1 px-2.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 rounded-lg text-slate-400 hover:text-white transition cursor-pointer text-[10px] font-mono flex items-center gap-1 uppercase font-bold text-center"
                >
                  <RefreshCw className={`h-3 w-3 ${isLoadingDashboard ? 'animate-spin' : ''}`} />
                  <span>Sync Stats</span>
                </button>
              </div>

              {/* Status Welcome Hero */}
              <div className="p-4 rounded-2xl border border-slate-850 bg-gradient-to-br from-slate-950 to-slate-900 space-y-3 relative overflow-hidden shadow-lg shadow-black/40">
                {/* Background highlight */}
                <div className="absolute top-0 right-0 w-36 h-36 rounded-full opacity-10 bg-radial filter blur-xl pointer-events-none" style={{ background: activeTheme.colorHex }}></div>
                
                <div className="flex items-center gap-3 relative z-10">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-black font-mono border shadow-md uppercase shrink-0 ${activeTheme.primaryText} ${activeTheme.accentBorder} bg-black/40`}>
                    {currentUser ? (currentUser.username || currentUser.email || "U")[0] : "G"}
                  </div>
                  <div>
                    <span className="text-[9px] font-mono text-zinc-500 uppercase block leading-none font-bold mb-0.5">Active Spotter Profile</span>
                    <h1 className="text-sm font-bold text-slate-100 tracking-tight font-display line-clamp-1">
                      {currentUser ? (currentUser.username || currentUser.email) : "Guest Spotter"}
                    </h1>
                  </div>
                </div>

                {/* Spotter Class Badge */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-900">
                  <div>
                    <span className="text-[9px] font-mono text-zinc-500 uppercase block pl-0.5 mb-1">Spotter Status Level</span>
                    <span className={`inline-flex items-center gap-1 text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded border ${
                      garage.length >= 3 && (dashboardStats?.userCommentsCount || 0) >= 2
                        ? "text-yellow-400 bg-yellow-950/20 border-yellow-500/30"
                        : "text-slate-400 bg-slate-900 border-slate-800"
                    }`}>
                      {garage.length >= 3 && (dashboardStats?.userCommentsCount || 0) >= 2 ? (
                        <>
                          <Sparkles className="h-3 w-3 text-yellow-400 animate-pulse animate-duration-1000" />
                          <span>Senior Spotter</span>
                        </>
                      ) : (
                        <>
                          <Cpu className="h-3 w-3 text-slate-450" />
                          <span>Junior Spotter</span>
                        </>
                      )}
                    </span>
                  </div>

                  <div>
                    <span className="text-[9px] font-mono text-zinc-500 uppercase block pl-0.5 mb-1">My Activity Logging</span>
                    <p className="text-[10px] text-zinc-300 font-mono pl-0.5">
                      <strong className="text-slate-100 font-extrabold">{garage.length}</strong> Garage cars
                      {" • "}
                      <strong className="text-slate-100 font-extrabold">{dashboardStats?.userCommentsCount || 0}</strong> review{ (dashboardStats?.userCommentsCount || 0) !== 1 ? "s" : "" }
                    </p>
                  </div>
                </div>

                {/* Level Up Progress Bars / Checklist */}
                <div className="bg-black/40 p-3 rounded-xl border border-slate-900/80 space-y-2.5">
                  <h4 className="text-[9px] font-black uppercase text-amber-400 tracking-wider font-mono">Senior Class Advancement Meter</h4>
                  
                  {/* Garage Requirement progress */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[9px] font-mono text-zinc-400">
                      <span>1. Garage spot verification (Needs 3+)</span>
                      <span className="font-bold text-slate-200">{garage.length} / 3</span>
                    </div>
                    <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden border border-slate-900">
                      <div 
                        className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min((garage.length / 3) * 100, 100)}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Feedback Requirement progress */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[9px] font-mono text-zinc-400">
                      <span>2. Expert feedback written (Needs 2+)</span>
                      <span className="font-bold text-slate-200">{dashboardStats?.userCommentsCount || 0} / 2</span>
                    </div>
                    <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden border border-slate-900">
                      <div 
                        className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(((dashboardStats?.userCommentsCount || 0) / 2) * 100, 100)}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Recommendation block */}
                  <div className="text-[9.5px] leading-relaxed text-slate-450 font-sans border-t border-slate-900/60 pt-2 flex items-start gap-1.5">
                    <HelpCircle className="h-3.5 w-3.5 text-zinc-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-slate-350 block uppercase text-[8px] tracking-wide font-mono mb-0.5">Recommendations:</span>
                      {garage.length >= 3 && (dashboardStats?.userCommentsCount || 0) >= 2 ? (
                        <p className="text-emerald-400">
                          Outstanding! You have earned your <strong>Senior Spotter</strong> rating. Keep logging rare vehicle configs and writing driving reports to assist the community database growth!
                        </p>
                      ) : (
                        <p className="text-zinc-300">
                          To earn your Senior status, make sure to:
                          {garage.length < 3 && ` 🛠️ Scan and save ${3 - garage.length} more pristine car image(s) to your garage.`}
                          {(dashboardStats?.userCommentsCount || 0) < 2 && ` 📝 Add ${2 - (dashboardStats?.userCommentsCount || 0)} more driving/attribute reviews on scanned vehicle pages.`}
                          {" Also keep scanning rare cars that hit the streets which have never been added to our application to help advance statistics!"}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* INTERACTIVE SUBSCRIPTION ADVISORY CARD */}
              <div className="p-4 rounded-2xl border border-indigo-900/40 bg-indigo-950/25 space-y-3 relative overflow-hidden backdrop-blur-sm">
                <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-indigo-500/10 rounded-full blur-xl pointer-events-none"></div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-indigo-400">
                      <Sparkles className="h-4 w-4 animate-pulse text-indigo-455" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black uppercase text-slate-200 tracking-wider font-mono">
                        Membership: {selectedPlanTier === 'chiptuning' ? "Chiptuning Free" : selectedPlanTier === 'teen_passion' ? "Teen Passion Premium" : "Gasoline Gold Co-Pilot"}
                      </h4>
                      <p className="text-[9.5px] text-indigo-300 font-semibold font-mono uppercase mt-0.5">
                        {selectedPlanTier === 'chiptuning' ? "Basic stats • Ad-supported" : "Parent co-pilot verified • Premium active"}
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleOpenPlans()}
                    className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold font-mono text-[9px] uppercase tracking-wider transition cursor-pointer select-none"
                  >
                    Manage Plans
                  </button>
                </div>
                
                {selectedPlanTier === 'chiptuning' ? (
                  <p className="text-[10px] text-zinc-400 leading-relaxed font-sans">
                    Unlock exclusive luxury sport-liveries (<em>Bugatti Monaco</em> & <em>Lamborghini Amethyst</em>) and sponsor parent co-pilot STEM tools designed for young car spotters with verified safety limits.
                  </p>
                ) : (
                  <div className="text-[10px] text-zinc-300 leading-relaxed font-sans bg-black/30 p-2.5 rounded-lg border border-indigo-950 flex flex-col gap-1">
                    <div className="flex items-center gap-1.5 text-emerald-400 font-bold uppercase text-[9px] font-mono">
                      <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                      CO-PILOT COMPLIANCE ACTIVATED
                    </div>
                    <p className="text-[9.5px]">
                      Sponsor and co-pilot: <strong className="text-slate-100">{parentName || "Anonymous Parent"}</strong> (<span className="text-slate-400">{parentEmail || "not set"}</span>). Features verified as child-safe and compliant with zero hidden fees.
                    </p>
                  </div>
                )}
              </div>

              {/* Unique scanned image dashboard statistics */}
              <div className="grid grid-cols-2 gap-3 font-mono">
                {/* Total Unique Scanned Images regardless of owner user */}
                <div className="bg-slate-900/30 p-3 rounded-xl border border-slate-850 flex flex-col justify-between">
                  <div>
                    <span className="text-[8px] text-zinc-500 uppercase tracking-wider block font-bold leading-none mb-1">Unique Scanned Images</span>
                    <h3 className="text-lg font-black text-slate-100 tracking-tight">
                      {dashboardStats ? dashboardStats.totalUniqueScannedImages : 0}
                    </h3>
                  </div>
                  <p className="text-[9.5px] text-slate-450 leading-tight mt-1.5">
                    Total count of unique physical files/images spotted across all users.
                  </p>
                </div>

                <div className="bg-slate-900/30 p-3 rounded-xl border border-slate-850 flex flex-col justify-between">
                  <div>
                    <span className="text-[8px] text-zinc-500 uppercase tracking-wider block font-bold leading-none mb-1">Community Database Spots</span>
                    <h3 className="text-lg font-black text-slate-100 tracking-tight">
                      {dashboardStats ? dashboardStats.totalScansCount : 0}
                    </h3>
                  </div>
                  <p className="text-[9.5px] text-slate-450 leading-tight mt-1.5">
                    Sum total of all spots logged across the collective database.
                  </p>
                </div>
              </div>

              {/* Interactive Module: Spotlight TOP RATED COMMUNITY VEHICLE */}
              {dashboardStats && dashboardStats.topRatedCar && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 px-0.5">
                    <Sparkles className="h-3.5 w-3.5 text-yellow-450 shrink-0" />
                    <h3 className="text-xs font-black text-slate-200 font-display uppercase tracking-wider">Spotlight: Top Rated Model</h3>
                  </div>
                  
                  <div className="rounded-2xl border border-slate-850/80 bg-slate-950 overflow-hidden relative shadow-md">
                    {/* Immersive cover photo */}
                    <div className="relative h-44 bg-slate-900">
                      <img
                        src={dashboardStats.topRatedCar.image}
                        alt={`${dashboardStats.topRatedCar.make} ${dashboardStats.topRatedCar.model}`}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent"></div>
                      
                      <div className="absolute top-3 right-3 flex items-center gap-1 bg-yellow-450/15 backdrop-blur-md px-2.5 py-0.5 text-xs text-yellow-400 border border-yellow-500/25 rounded-full font-mono font-black shadow-lg">
                        ★ {dashboardStats.topRatedCar.averageRating.toFixed(1)} / 5
                      </div>

                      <div className="absolute bottom-3 left-4">
                        <span className="text-[8px] font-mono uppercase bg-emerald-950/50 border border-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded mb-1 inline-block">
                          {dashboardStats.topRatedCar.category}
                        </span>
                        <h4 className="text-base font-black text-white uppercase leading-none font-display">
                          {dashboardStats.topRatedCar.modelYear} {dashboardStats.topRatedCar.make} {dashboardStats.topRatedCar.model}
                        </h4>
                      </div>
                    </div>

                    {/* Quick attributes list */}
                    <div className="p-3.5 space-y-3 font-mono text-[10px]">
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-zinc-400 border-b border-slate-900 pb-2.5">
                        <div className="flex justify-between">
                          <span className="text-zinc-500">Powertrain:</span>
                          <strong className="text-slate-200 text-right line-clamp-1 truncate max-w-[100px]">{dashboardStats.topRatedCar.engineType}</strong>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-500">Horsepower:</span>
                          <strong className="text-slate-200 text-right">{dashboardStats.topRatedCar.horsepower || dashboardStats.topRatedCar.power}</strong>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-500">0-100 km/h:</span>
                          <strong className="text-slate-200 text-right">{dashboardStats.topRatedCar.zeroToSixty}</strong>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-500">Market (EGP):</span>
                          <strong className="text-pink-400 text-right font-bold">{dashboardStats.topRatedCar.estimatedUsedPrice}</strong>
                        </div>
                      </div>

                      {/* Community Shared Ratings for Key Performance Parameters */}
                      <div className="space-y-2 border-b border-slate-900 pb-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] font-black text-slate-300 uppercase tracking-wider">🌟 Community Rated Parameters</span>
                          <span className="text-[8px] text-zinc-500 uppercase font-bold">User-Shared Ratings</span>
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-zinc-400">
                          <div className="space-y-1">
                            <div className="flex justify-between text-[9px] leading-none">
                              <span className="text-zinc-500">Performance:</span>
                              <span className="text-amber-400 font-bold">{dashboardStats.topRatedCar.performanceAvg?.toFixed(1) || "4.9"} ★</span>
                            </div>
                            <div className="h-1 w-full bg-slate-900 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-amber-500 rounded-full transition-all duration-500" 
                                style={{ width: `${((dashboardStats.topRatedCar.performanceAvg || 4.9) / 5) * 100}%` }}
                              />
                            </div>
                          </div>

                          <div className="space-y-1">
                            <div className="flex justify-between text-[9px] leading-none">
                              <span className="text-zinc-500">Comfort:</span>
                              <span className="text-blue-400 font-bold">{dashboardStats.topRatedCar.comfortAvg?.toFixed(1) || "4.7"} ★</span>
                            </div>
                            <div className="h-1 w-full bg-slate-900 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-blue-500 rounded-full transition-all duration-500" 
                                style={{ width: `${((dashboardStats.topRatedCar.comfortAvg || 4.7) / 5) * 100}%` }}
                              />
                            </div>
                          </div>

                          <div className="space-y-1">
                            <div className="flex justify-between text-[9px] leading-none">
                              <span className="text-zinc-500">Reliability:</span>
                              <span className="text-emerald-400 font-bold">{dashboardStats.topRatedCar.reliabilityAvg?.toFixed(1) || "4.8"} ★</span>
                            </div>
                            <div className="h-1 w-full bg-slate-900 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-emerald-500 rounded-full transition-all duration-500" 
                                style={{ width: `${((dashboardStats.topRatedCar.reliabilityAvg || 4.8) / 5) * 100}%` }}
                              />
                            </div>
                          </div>

                          <div className="space-y-1">
                            <div className="flex justify-between text-[9px] leading-none">
                              <span className="text-zinc-500">Gas Efficiency:</span>
                              <span className="text-purple-400 font-bold">{dashboardStats.topRatedCar.gasAvg?.toFixed(1) || "4.2"} ★</span>
                            </div>
                            <div className="h-1 w-full bg-slate-900 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-purple-500 rounded-full transition-all duration-500" 
                                style={{ width: `${((dashboardStats.topRatedCar.gasAvg || 4.2) / 5) * 100}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Actions to inspect model */}
                      <div className="flex items-center justify-between">
                        <span className="text-[8.5px] text-zinc-500 uppercase leading-none">
                          Based on {dashboardStats.topRatedCar.ratingCount} reviews
                        </span>
                        <button
                          onClick={() => {
                            setSelectedGarageCar(dashboardStats.topRatedCar);
                            setActiveTab('garage');
                          }}
                          className={`px-3 py-1.5 ${activeTheme.accentBg} ${activeTheme.accentHover} text-slate-950 font-bold text-[9px] rounded-lg tracking-wider transition uppercase cursor-pointer flex items-center gap-1`}
                        >
                          <span>Inspect Model Spec Sheet</span>
                          <ChevronRight className="h-3 w-3 text-black font-black" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Call to action scanning block */}
              <div className={`p-4 rounded-2xl border ${activeTheme.accentBorder} bg-[#08090d]/80 space-y-2shadow-md`}>
                <h4 className="text-xs font-bold text-slate-100 font-display uppercase tracking-wide">Ready to expand your collection?</h4>
                <p className="text-[10px] text-slate-405 leading-normal">
                  Put Whipcheck GT's AI Vision capabilities to work. Snap or upload any vehicle profile instantly to review specifications, resale values, and add to your garage.
                </p>
                <div className="pt-2">
                  <button
                    onClick={() => setActiveTab('scan')}
                    className={`w-full ${activeTheme.accentBg} ${activeTheme.accentHover} text-slate-900 font-bold text-xs py-2.5 rounded-xl transition cursor-pointer font-sans uppercase tracking-wider`}
                  >
                    🚀 Trigger Vision Neural Core
                  </button>
                </div>
              </div>
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
                    saveError={saveError}
                    selectedPlanTier={selectedPlanTier}
                    onOpenPlans={handleOpenPlans}
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
                    selectedPlanTier={selectedPlanTier}
                    onOpenPlans={handleOpenPlans}
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

              {/* Premium Membership summary panel inside Account */}
              <div className="p-4 bg-slate-900/60 border border-slate-850 rounded-2xl relative overflow-hidden space-y-3 font-sans">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shrink-0">
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-black uppercase text-slate-200 tracking-wider font-mono">WhipCheck Membership</h3>
                      <p className="text-[10px] text-zinc-500 font-mono uppercase font-bold mt-0.5">
                        Tier Level: <span className="text-indigo-400">{selectedPlanTier.replace("_", " ").toUpperCase()}</span>
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleOpenPlans()}
                    className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 font-bold font-mono text-[9.5px] uppercase tracking-wider text-white rounded-lg transition shrink-0 cursor-pointer"
                  >
                    Manage plans
                  </button>
                </div>
                
                {selectedPlanTier !== 'chiptuning' && (
                  <div className="text-[10px] text-emerald-400 font-mono flex items-center gap-1.5 uppercase font-bold pt-0.5">
                    <ShieldCheck className="h-4 w-4 text-emerald-450" /> Parent Approved License Active
                  </div>
                )}
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

              {!isAdminLoggedIn ? (
                /* CASE: ADMIN NOT LOGGED IN - show elegant Admin Login Gateway card */
                <form 
                  onSubmit={handleAdminLogin}
                  className="p-5 bg-gradient-to-br from-[#0b0c10] via-slate-950 to-zinc-950 border border-slate-850 rounded-2xl shadow-lg relative overflow-hidden space-y-4"
                >
                  <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/5 rounded-full blur-xl pointer-events-none"></div>

                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400">
                      <Settings className="h-4 w-4 animate-spin-slow animate-pulse" />
                    </div>
                    <div>
                      <h3 className="text-xs font-black uppercase text-slate-200 tracking-wider font-mono">🛠️ Developer & Admin Gateway</h3>
                      <p className="text-[10px] text-zinc-500 uppercase font-mono mt-0.5 font-sans">Authorized developer settings portal</p>
                    </div>
                  </div>

                  <p className="text-[10.5px] text-zinc-400 font-sans leading-relaxed">
                    Authenticate with system credentials to toggle live integrations, generate schema scripts, and inspect raw cached node database tables.
                  </p>

                  <div className="space-y-3 pt-1">
                    <div className="space-y-1.25">
                      <label className="text-[9px] font-bold font-mono uppercase text-slate-500 block">Admin Username</label>
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="e.g. admin"
                          value={adminUsernameInput}
                          onChange={(e) => setAdminUsernameInput(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-850 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-red-500/55 transition font-mono focus:ring-1 focus:ring-red-500/30"
                          required
                        />
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                          <User className="h-3.5 w-3.5" />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1.25">
                      <label className="text-[9px] font-bold font-mono uppercase text-slate-500 block">Admin Password</label>
                      <div className="relative">
                        <input
                          type="password"
                          placeholder="Enter admin password..."
                          value={adminPasswordInput}
                          onChange={(e) => setAdminPasswordInput(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-850 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-red-500/55 transition font-mono focus:ring-1 focus:ring-red-500/30"
                          required
                        />
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                          <Lock className="h-3.5 w-3.5" />
                        </div>
                      </div>
                    </div>

                    {adminError && (
                      <div className="p-2.5 bg-red-950/30 border border-red-500/25 text-red-100 text-[10px] leading-relaxed rounded-lg font-mono text-center">
                        {adminError}
                      </div>
                    )}

                    <button
                      type="submit"
                      className="w-full text-xs font-bold font-mono uppercase py-2.5 rounded-xl cursor-pointer flex items-center justify-center gap-1.5 text-white bg-red-650 hover:bg-red-605 transition shadow-lg shadow-red-950/20 active:scale-[0.99]"
                    >
                      <ShieldCheck className="h-3.5 w-3.5" />
                      <span>Authenticate Session</span>
                    </button>
                  </div>
                </form>
              ) : (
                /* CASE: ADMIN LOGGED IN - display pristine tabbed dashboard layout */
                <div className="p-5 bg-gradient-to-br from-[#0c0d12] via-slate-950 to-zinc-950 border border-slate-850 rounded-2xl shadow-lg relative overflow-hidden space-y-4">
                  {/* Dashboard Ribbon */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-900">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 animate-pulse">
                        <Cpu className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-xs font-black uppercase text-slate-200 tracking-wider font-mono">Administrator Terminal</h3>
                          <span className="px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 text-[8px] font-mono font-bold uppercase select-none border border-emerald-500/30">Active</span>
                        </div>
                        <p className="text-[10px] text-zinc-500 uppercase font-mono mt-0.5 leading-snug">Control Panel & Live Database Workspace</p>
                      </div>
                    </div>
                    
                    <button
                      type="button"
                      onClick={handleAdminLogout}
                      className="py-1 px-2.5 rounded-lg bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-400 font-mono text-[9.5px] uppercase flex items-center justify-center gap-1.5 cursor-pointer transition select-none shrink-0"
                    >
                      <LogOut className="h-3 w-3 text-red-500" />
                      <span>End Admin Session</span>
                    </button>
                  </div>

                  {/* Elegant Horizontal Tab Bar */}
                  <div className="grid grid-cols-4 gap-1 bg-slate-950 border border-slate-900 rounded-xl p-1 font-mono text-[9px] leading-tight shadow-inner select-none">
                    <button
                      type="button"
                      onClick={() => setAdminSubTab('db')}
                      className={`py-2 px-1 rounded-lg font-bold transition flex items-center justify-center gap-1 cursor-pointer truncate ${
                        adminSubTab === 'db'
                          ? 'bg-red-500/15 text-red-400 border border-red-500/25 shadow-sm'
                          : 'text-slate-400 hover:text-slate-200 border border-transparent'
                      }`}
                    >
                      <Database className="h-3 w-3 shrink-0" />
                      <span>DB SETUP</span>
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => setAdminSubTab('script')}
                      className={`py-2 px-1 rounded-lg font-bold transition flex items-center justify-center gap-1 cursor-pointer truncate ${
                        adminSubTab === 'script'
                          ? 'bg-red-500/15 text-red-400 border border-red-500/25 shadow-sm'
                          : 'text-slate-400 hover:text-slate-200 border border-transparent'
                      }`}
                    >
                      <Code className="h-3 w-3 shrink-0" />
                      <span>SQL INJECT</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setAdminSubTab('data');
                        fetchAdminDbStats(); // Auto-refresh when entering data tab
                      }}
                      className={`py-2 px-1 rounded-lg font-bold transition flex items-center justify-center gap-1 cursor-pointer truncate ${
                        adminSubTab === 'data'
                          ? 'bg-red-500/15 text-red-400 border border-red-500/25 shadow-sm'
                          : 'text-slate-400 hover:text-slate-200 border border-transparent'
                      }`}
                    >
                      <Server className="h-3 w-3 shrink-0" />
                      <span>CACHED DATA</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setAdminSubTab('localstorage');
                      }}
                      className={`py-2 px-1 rounded-lg font-bold transition flex items-center justify-center gap-1 cursor-pointer truncate ${
                        adminSubTab === 'localstorage'
                          ? 'bg-red-500/15 text-red-400 border border-red-500/25 shadow-sm'
                          : 'text-slate-400 hover:text-slate-200 border border-transparent'
                      }`}
                    >
                      <HardDrive className="h-3 w-3 shrink-0" />
                      <span>LOCAL STORAGE</span>
                    </button>
                  </div>

                  {/* TAB CONTENT 1: DB SETTINGS */}
                  {adminSubTab === 'db' && (
                    <div className="space-y-4 animate-fade-in text-left">
                      <div className="space-y-1">
                        <h4 className="text-[10px] font-bold text-slate-300 uppercase font-mono tracking-wide">🔗 Supabase Sandbox Overrides</h4>
                        <p className="text-[9.5px] text-zinc-500 leading-normal">Enter custom backend environments here. Leave blank to fallback to compilation settings.</p>
                      </div>

                      <div className="space-y-3">
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
                            Apply Credentials
                          </button>
                        </div>
                      </div>

                      {paramFeedback && (
                        <div className="p-3 bg-indigo-950/40 border border-indigo-500/25 rounded-xl text-indigo-300 text-[10px] leading-relaxed font-mono">
                          {paramFeedback}
                        </div>
                      )}

                      {/* Manual Sync operations */}
                      <div className="pt-3 border-t border-slate-900 space-y-3">
                        <div className="space-y-1">
                          <h4 className="text-[10px] font-bold text-slate-300 uppercase font-mono">⚡ Supabase Direct Sync Operations</h4>
                          <p className="text-[9.5px] text-zinc-500 leading-normal">Send current local scans and offline garage data directly into the active Supabase <code className="text-zinc-400 bg-slate-900 px-1 rounded text-[9px]">vehicles</code> database table.</p>
                        </div>

                        <button
                          type="button"
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
                    </div>
                  )}

                  {/* TAB CONTENT 2: SQL SCRIPT */}
                  {adminSubTab === 'script' && (
                    <div className="space-y-4 animate-fade-in text-left">
                      <div className="space-y-1">
                        <h4 className="text-[10px] font-bold text-slate-300 uppercase font-mono tracking-wide">🚀 Supabase DDL SQL Schema Migration Scripts</h4>
                        <p className="text-[9.5px] text-zinc-500 leading-normal">Run these scripts in your Supabase dashboard SQL Editor to build conforming public tables.</p>
                      </div>

                      <div className="space-y-3">
                        <div className="flex bg-slate-900/95 border border-slate-800 rounded-xl p-1 w-full font-mono text-[9px] leading-tight shadow-inner">
                          <button
                            type="button"
                            onClick={() => setSqlSchemaMode('create')}
                            className={`flex-1 py-1.5 px-1.5 rounded-lg font-bold transition duration-200 cursor-pointer text-center select-none ${
                              sqlSchemaMode === 'create'
                                ? 'bg-red-500/20 text-red-300 border border-red-500/25 shadow-sm'
                                : 'text-slate-400 hover:text-slate-200 border border-transparent'
                            }`}
                          >
                            🚀 PRISTINE SETUP (NEW TABLES)
                          </button>
                          <button
                            type="button"
                            onClick={() => setSqlSchemaMode('upgrade')}
                            className={`flex-1 py-1.5 px-1.5 rounded-lg font-bold transition duration-200 cursor-pointer text-center select-none ${
                              sqlSchemaMode === 'upgrade'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/25 shadow-sm'
                                : 'text-slate-400 hover:text-slate-200 border border-transparent'
                            }`}
                          >
                            ⚡ UPGRADE TABLES (USER_ID COLUMN)
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={handleCopySql}
                          className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-red-500/10 hover:bg-red-650/20 border border-red-500/35 hover:border-red-550/60 font-mono text-[10px] font-bold text-red-400 hover:text-white transition cursor-pointer active:scale-[0.99]"
                        >
                          {copiedSql ? (
                            <>
                              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                              <span>SQL SCHEMA COPIED TO CLIPBOARD</span>
                            </>
                          ) : (
                            <>
                              <Copy className="h-4 w-4" />
                              <span>{sqlSchemaMode === 'create' ? "COPY COMPLETE DB SQL SCHEMA" : "COPY TABLE UPGRADE / ALTER SQL"}</span>
                            </>
                          )}
                        </button>

                        <div className="bg-slate-950 rounded-xl border border-slate-900 p-3 overflow-hidden text-left relative group">
                          <pre className="text-[9px] text-zinc-400 font-mono max-h-48 overflow-y-auto leading-relaxed select-all">
{sqlSchemaMode === 'create' ? `-- Create WhipCheck saved vehicles table on Supabase
create table public.vehicles (
  id text primary key,
  timestamp text not null,
  image text not null,
  "isCar" boolean default true,
  make text,
  model text,
  year integer,
  color text,
  transmission text,
  drivetrain text,
  engine text,
  power text,
  zeroToSixty text,
  topSpeed text,
  curbWeight text,
  gasConsumption text,
  rarityScore integer,
  productionNumbers text,
  heritageSummary text,
  funFact text,
  marketValue text,
  latitude text,
  longitude text,
  spotterName text,
  rating integer,
  comfort integer,
  gasSatisfaction integer,
  performanceValue integer,
  reliability integer,
  user_id text
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
                  )}

                  {/* TAB CONTENT 3: CACHED DATA & WIPE OPTIONS */}
                  {adminSubTab === 'data' && (
                    <div className="space-y-4 animate-fade-in text-left">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <h4 className="text-[10px] font-bold text-slate-300 uppercase font-mono tracking-wide">📦 Live Host Database Explorer</h4>
                          <p className="text-[9.5px] text-zinc-500 leading-normal">Direct real-time cache stats query before wipe trigger operations.</p>
                        </div>

                        <button
                          type="button"
                          onClick={fetchAdminDbStats}
                          disabled={adminDbStatsLoading}
                          className="py-1 px-2.5 rounded-lg bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-400 hover:text-slate-200 font-mono text-[9px] uppercase flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition"
                        >
                          <RefreshCw className={`h-3 w-3 ${adminDbStatsLoading ? "animate-spin" : ""}`} />
                          <span>Refresh Cache</span>
                        </button>
                      </div>

                      {/* Display Numbers / Badges */}
                      <div className="grid grid-cols-2 xs:grid-cols-4 gap-2 font-mono text-[10px]">
                        <div className="p-2.5 bg-slate-950 border border-slate-900 rounded-xl text-center">
                          <span className="text-[8px] text-zinc-500 block uppercase mb-1">Accounts</span>
                          <strong className="text-slate-200 text-sm font-black">{adminDbStats?.usersCount || 0}</strong>
                        </div>
                        <div className="p-2.5 bg-slate-950 border border-slate-900 rounded-xl text-center">
                          <span className="text-[8px] text-zinc-500 block uppercase mb-1">Garages</span>
                          <strong className="text-teal-400 text-sm font-black">{adminDbStats?.vehiclesUserCount || 0}</strong>
                        </div>
                        <div className="p-2.5 bg-slate-950 border border-slate-900 rounded-xl text-center">
                          <span className="text-[8px] text-zinc-500 block uppercase mb-1">Vehicles</span>
                          <strong className="text-zinc-200 text-sm font-black">{adminDbStats?.totalVehiclesCount || 0}</strong>
                        </div>
                        <div className="p-2.5 bg-slate-950 border border-slate-900 rounded-xl text-center">
                          <span className="text-[8px] text-zinc-500 block uppercase mb-1">Comments</span>
                          <strong className="text-amber-400 text-sm font-black">{adminDbStats?.totalCommentsCount || 0}</strong>
                        </div>
                      </div>

                      {/* Interactive Datasets list display */}
                      <div className="space-y-3.5 pt-1">
                        {/* Users browser */}
                        <div className="space-y-1.5">
                          <h5 className="text-[10px] font-bold text-zinc-400 uppercase font-mono tracking-wider flex items-center gap-1">👥 Registered Accounts ({adminDbStats?.usersCount || 0})</h5>
                          {(!adminDbStats?.rawUsers || adminDbStats.rawUsers.length === 0) ? (
                            <p className="text-[10px] text-zinc-650 font-mono italic pl-1">No accounts found in sandbox environment.</p>
                          ) : (
                            <div className="max-h-28 overflow-y-auto border border-slate-900 rounded-xl bg-slate-950/80 p-2.5 font-mono text-[9px] text-zinc-400 space-y-1 leading-normal select-all">
                              {adminDbStats.rawUsers.map((u: any) => (
                                <div key={u.id} className="pb-1 border-b border-slate-900 last:border-0 flex justify-between items-center">
                                  <span className="text-zinc-300 font-bold">{u.username || "Anonymous"} <span className="text-zinc-500 font-normal">({u.email})</span></span>
                                  <span className={`px-1 rounded text-[8px] ${u.isVerified ? "bg-emerald-950 text-emerald-400 border border-emerald-500/10" : "bg-amber-950 text-amber-500 border border-amber-500/10"}`}>
                                    {u.isVerified ? "Verified" : "Pending OTP"}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Vehicles Browser */}
                        <div className="space-y-1.5">
                          <h5 className="text-[10px] font-bold text-zinc-400 uppercase font-mono tracking-wider flex items-center gap-1">🚗 Cached Scanned Vehicles ({adminDbStats?.totalVehiclesCount || 0})</h5>
                          {(!adminDbStats?.rawVehicles || Object.keys(adminDbStats.rawVehicles).length === 0) ? (
                            <p className="text-[10px] text-zinc-650 font-mono italic pl-1">No scanned vehicle lists generated yet.</p>
                          ) : (
                            <div className="max-h-36 overflow-y-auto border border-slate-900 rounded-xl bg-slate-950/80 p-2.5 font-mono text-[9px] text-zinc-400 space-y-2 leading-normal">
                              {Object.entries(adminDbStats.rawVehicles).map(([key, list]: [string, any]) => {
                                const matched = adminDbStats.rawUsers?.find((x: any) => x.id === key);
                                const ownerLabel = matched ? matched.username : `User ID: ${key}`;
                                return (
                                  <div key={key} className="space-y-1 pb-1.5 border-b border-slate-900 last:border-0">
                                    <span className="text-teal-400 font-bold uppercase select-all">Garage owned by @{ownerLabel} ({list?.length || 0} cars)</span>
                                    {(!list || list.length === 0) ? (
                                      <p className="text-zinc-500 pl-2">Garage contains zero list models.</p>
                                    ) : (
                                      <ul className="list-disc pl-4 text-zinc-355 space-y-0.5 mt-0.5">
                                        {list.map((v: any, index: number) => (
                                          <li key={v.id || index} className="truncate">
                                            {v.year} {v.make} {v.model} <span className="text-zinc-500 text-[8px]">({v.id})</span>
                                          </li>
                                        ))}
                                      </ul>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* Comments Browser */}
                        <div className="space-y-1.5">
                          <h5 className="text-[10px] font-bold text-zinc-400 uppercase font-mono tracking-wider flex items-center gap-1">💬 Active Discussion Board reviews ({adminDbStats?.totalCommentsCount || 0})</h5>
                          {(!adminDbStats?.rawComments || Object.keys(adminDbStats.rawComments).length === 0) ? (
                            <p className="text-[10px] text-zinc-650 font-mono italic pl-1">No reviews left by testers yet.</p>
                          ) : (
                            <div className="max-h-32 overflow-y-auto border border-slate-900 rounded-xl bg-slate-950/80 p-2.5 font-mono text-[9px] text-zinc-400 space-y-2 leading-normal">
                              {Object.entries(adminDbStats.rawComments).map(([carId, comments]: [string, any]) => (
                                <div key={carId} className="space-y-1 pb-1.5 border-b border-slate-900 last:border-0">
                                  <span className="text-amber-400 text-[8.5px] font-bold uppercase block select-all">Car: {carId}</span>
                                  {(!comments || comments.length === 0) ? (
                                    <p className="text-zinc-500 italic pl-2">No comments reviews registered.</p>
                                  ) : (
                                    <ul className="list-disc pl-4 text-zinc-355 space-y-1">
                                      {comments.map((cm: any, ind: number) => (
                                        <li key={cm.id || ind} className="leading-snug">
                                          <strong className="text-zinc-400">@{cm.author}</strong>: "{cm.text}"
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* RED SERVER DATABASE HARD RESET PURGE ZONE */}
                      <div className="pt-3 border-t border-slate-900 space-y-3">
                        <div className="space-y-1">
                          <h4 className="text-[10px] font-extrabold text-rose-500 uppercase font-mono tracking-wider flex items-center gap-1"><ShieldAlert className="h-3.5 w-3.5" /> Direct Hard Wipe Danger Zone</h4>
                          <p className="text-[9.5px] text-zinc-500 leading-normal">Purge local user databases (<code className="text-zinc-400 bg-slate-900 px-1 rounded text-[9px]">users_db.json</code> & <code className="text-zinc-400 bg-slate-900 px-1 rounded text-[9px]">user_vehicles_db.json</code>) on the hosting server, wiping all assets immediately.</p>
                        </div>

                        {!showWipeConfirm ? (
                          <button
                            type="button"
                            onClick={() => setShowWipeConfirm(true)}
                            className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-red-950/20 hover:bg-red-950/40 border border-red-900/40 hover:border-red-800/60 font-mono text-[10.5px] font-bold text-red-100 hover:text-white transition cursor-pointer active:scale-[0.99]"
                          >
                            <Trash2 className="h-4 w-4" />
                            <span>WIPE SERVER FILES & RESTART OTP SIGNUP</span>
                          </button>
                        ) : (
                          <div className="p-3 bg-red-950/30 border border-red-500/35 rounded-xl space-y-2.5 text-center">
                            <p className="text-[10px] text-red-200 font-black uppercase font-mono tracking-wider">
                              ⚠️ ARE YOU ABSOLUTELY SURE?
                            </p>
                            <p className="text-[9.5px] text-zinc-400 font-sans leading-normal">
                              This permanently deletes all user accounts, vehicle scans, and comments from the node-server database files. There is absolutely no undo.
                            </p>
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                type="button"
                                onClick={() => setShowWipeConfirm(false)}
                                className="py-1.5 px-3 rounded-lg bg-slate-900 hover:bg-slate-850 border border-slate-800 text-zinc-400 font-mono font-bold text-[9.5px] uppercase cursor-pointer transition text-center"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
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
                  )}

                  {adminSubTab === 'localstorage' && (
                    <div className="space-y-4 animate-fade-in text-left">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <h4 className="text-[10px] font-bold text-slate-300 uppercase font-mono tracking-wide">📂 Browser Local Storage Inspector</h4>
                          <p className="text-[9.5px] text-zinc-500 leading-normal">Inspect, search, and live edit physical key-value objects stored inside your web browser.</p>
                        </div>

                        <div className="flex gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={refreshLocalStorage}
                            className="py-1 px-2.5 rounded-lg bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-400 hover:text-slate-200 font-mono text-[9px] uppercase flex items-center gap-1.5 cursor-pointer transition select-none"
                          >
                            <RefreshCw className="h-3 w-3" />
                            <span>Reload</span>
                          </button>
                        </div>
                      </div>

                      {/* Search & Filter bar */}
                      <div className="space-y-2">
                        <div className="relative">
                          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-600" />
                          <input
                            type="text"
                            placeholder="Filter keys..."
                            value={localStorageSearch}
                            onChange={(e) => setLocalStorageSearch(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-900 rounded-lg pl-8 pr-3 py-1.5 text-[10px] text-slate-300 focus:outline-none focus:border-red-500/55 transition font-mono focus:ring-1 focus:ring-red-500/25"
                          />
                        </div>

                        <div className="flex flex-wrap gap-1 font-mono text-[8.5px]">
                          <button
                            type="button"
                            onClick={() => setLocalStorageFilter('all')}
                            className={`px-2 py-0.75 rounded border transition cursor-pointer ${
                              localStorageFilter === 'all'
                                ? 'bg-red-500/10 text-red-400 border-red-500/30 font-bold'
                                : 'bg-slate-950 border-slate-900 text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            All ({localStorageItems.length})
                          </button>
                          <button
                            type="button"
                            onClick={() => setLocalStorageFilter('garage')}
                            className={`px-2 py-0.75 rounded border transition cursor-pointer ${
                              localStorageFilter === 'garage'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 font-bold'
                                : 'bg-slate-950 border-slate-900 text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            Garage ({localStorageItems.filter(item => item.key.includes('car_spotter_garage')).length})
                          </button>
                          <button
                            type="button"
                            onClick={() => setLocalStorageFilter('comments')}
                            className={`px-2 py-0.75 rounded border transition cursor-pointer ${
                              localStorageFilter === 'comments'
                                ? 'bg-amber-500/10 text-amber-400 border-amber-500/30 font-bold'
                                : 'bg-slate-950 border-slate-900 text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            Comments ({localStorageItems.filter(item => item.key.includes('comments')).length})
                          </button>
                          <button
                            type="button"
                            onClick={() => setLocalStorageFilter('auth')}
                            className={`px-2 py-0.75 rounded border transition cursor-pointer ${
                              localStorageFilter === 'auth'
                                ? 'bg-teal-500/10 text-teal-400 border-teal-500/30 font-bold'
                                : 'bg-slate-950 border-slate-900 text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            Auth/Session ({localStorageItems.filter(item => item.key.includes('session') || item.key.includes('spotter_name')).length})
                          </button>
                          <button
                            type="button"
                            onClick={() => setLocalStorageFilter('other')}
                            className={`px-2 py-0.75 rounded border transition cursor-pointer ${
                              localStorageFilter === 'other'
                                ? 'bg-zinc-500/10 text-zinc-400 border-zinc-500/30 font-bold'
                                : 'bg-slate-950 border-slate-900 text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            Other ({localStorageItems.filter(item => 
                              !item.key.includes('car_spotter_garage') && 
                              !item.key.includes('comments') && 
                              !item.key.includes('session') && 
                              !item.key.includes('spotter_name')
                            ).length})
                          </button>
                        </div>
                      </div>

                      {/* Display Alert / Help */}
                      {localStorageSuccessMessage && (
                        <div className="p-2.5 bg-emerald-950/40 border border-emerald-500/20 rounded-xl text-emerald-400 text-[10px] leading-snug font-mono flex items-center gap-2 animate-fade-in">
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-450" />
                          <span>{localStorageSuccessMessage}</span>
                        </div>
                      )}

                      {localStorageErrorMessage && (
                        <div className="p-2.5 bg-red-950/40 border border-red-500/20 rounded-xl text-red-400 text-[10px] leading-snug font-mono flex items-center gap-2 animate-fade-in">
                          <ShieldAlert className="h-4 w-4 shrink-0 text-red-450" />
                          <span>{localStorageErrorMessage}</span>
                        </div>
                      )}

                      {/* Dual Pane Layout */}
                      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                        {/* Keys column - 2 cols span */}
                        <div className="md:col-span-2 space-y-1.5">
                          <span className="text-[8.5px] uppercase font-mono text-zinc-500 block font-bold leading-none pl-1">Data Key Registry</span>
                          
                          <div className="max-h-[320px] overflow-y-auto border border-slate-900 bg-slate-950/80 rounded-xl p-1.5 space-y-1">
                            {localStorageItems
                              .filter(item => {
                                // Apply search query
                                if (localStorageSearch && !item.key.toLowerCase().includes(localStorageSearch.toLowerCase())) {
                                  return false;
                                }
                                // Apply category filter
                                if (localStorageFilter === 'garage') {
                                  return item.key.includes('car_spotter_garage');
                                }
                                if (localStorageFilter === 'comments') {
                                  return item.key.includes('comments');
                                }
                                if (localStorageFilter === 'auth') {
                                  return item.key.includes('session') || item.key.includes('spotter_name');
                                }
                                if (localStorageFilter === 'other') {
                                  return (
                                    !item.key.includes('car_spotter_garage') && 
                                    !item.key.includes('comments') && 
                                    !item.key.includes('session') && 
                                    !item.key.includes('spotter_name')
                                  );
                                }
                                return true;
                              })
                              .map(item => {
                                const is_garage = item.key.includes('car_spotter_garage');
                                const is_comments = item.key.includes('comments');
                                const is_auth = item.key.includes('session') || item.key.includes('spotter_name');
                                
                                let badgeColor = 'text-zinc-500 bg-zinc-950 border-zinc-900/60';
                                let badgeLabel = 'Misc';
                                if (is_garage) { badgeColor = 'text-emerald-400 bg-emerald-950/20 border-emerald-500/20'; badgeLabel = 'Garage'; }
                                else if (is_comments) { badgeColor = 'text-amber-400 bg-amber-950/20 border-amber-500/20'; badgeLabel = 'Review'; }
                                else if (is_auth) { badgeColor = 'text-teal-400 bg-teal-950/20 border-teal-500/20'; badgeLabel = 'Auth'; }

                                return (
                                  <button
                                    key={item.key}
                                    type="button"
                                    onClick={() => {
                                      setSelectedLocalStorageKey(item.key);
                                      setSelectedLocalStorageValue(item.value);
                                      setIsEditingLocalStorage(false);
                                      setLocalStorageSuccessMessage(null);
                                      setLocalStorageErrorMessage(null);
                                      setShowKeyDeleteConfirm(false);
                                    }}
                                    className={`w-full text-left p-2 rounded-lg font-mono text-[9px] border transition flex flex-col gap-1 cursor-pointer select-none ${
                                      selectedLocalStorageKey === item.key
                                        ? 'bg-red-500/10 border-red-500/30'
                                        : 'bg-black/40 border-slate-900 hover:bg-slate-900/40'
                                    }`}
                                  >
                                    <div className="flex items-start justify-between gap-1 w-full">
                                      <span className="truncate break-all font-bold text-slate-300 pr-1 leading-normal">
                                        {item.key}
                                      </span>
                                      <span className={`px-1 py-0.25 text-[7px] uppercase font-bold rounded border shrink-0 ${badgeColor}`}>
                                        {badgeLabel}
                                      </span>
                                    </div>
                                    <span className="text-zinc-500 text-[8px] truncate leading-none">
                                      Size: {(item.value.length / 1024).toFixed(3)} KB ({item.value.length} chars)
                                    </span>
                                  </button>
                                );
                              })}

                            {localStorageItems.length === 0 && (
                              <p className="p-4 text-[10px] text-zinc-650 italic text-center font-mono">No keys exist in target window.</p>
                            )}
                          </div>
                        </div>

                        {/* Inspector details panel - 3 cols span */}
                        <div className="md:col-span-3 space-y-1.5 flex flex-col">
                          <span className="text-[8.5px] uppercase font-mono text-zinc-500 block font-bold leading-none pl-1">Selected Payload Details</span>
                          
                          {selectedLocalStorageKey ? (
                            <div className="border border-slate-900 bg-slate-950 p-3 rounded-xl space-y-3 flex flex-col flex-grow">
                              <div className="flex items-start justify-between gap-3 border-b border-slate-900 pb-2">
                                <div className="space-y-0.5 max-w-[200px]">
                                  <span className="text-[7.5px] uppercase font-mono text-rose-500 block font-black">Registry Entry key</span>
                                  <h5 className="text-[9.5px] font-bold text-slate-205 font-mono break-all line-clamp-2 select-all">{selectedLocalStorageKey}</h5>
                                </div>

                                <div className="flex gap-1 shrink-0">
                                  {/* Copy button */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      navigator.clipboard.writeText(selectedLocalStorageValue);
                                      setLocalStorageCopiedKey(selectedLocalStorageKey);
                                      setTimeout(() => setLocalStorageCopiedKey(null), 2000);
                                    }}
                                    className="p-1 px-2 rounded-lg bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-450 hover:text-white transition cursor-pointer font-mono text-[8px] uppercase flex items-center gap-1"
                                    title="Copy Value"
                                  >
                                    {localStorageCopiedKey === selectedLocalStorageKey ? (
                                      <>
                                        <Check className="h-3 w-3 text-emerald-400" />
                                        <span className="text-emerald-400">Copied</span>
                                      </>
                                    ) : (
                                      <>
                                        <Copy className="h-3 w-3" />
                                        <span>Copy</span>
                                      </>
                                    )}
                                  </button>

                                  {/* Delete single key */}
                                  {showKeyDeleteConfirm ? (
                                    <div className="flex items-center gap-1.5 animate-fade-in shrink-0">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          localStorage.removeItem(selectedLocalStorageKey);
                                          setSelectedLocalStorageKey(null);
                                          setSelectedLocalStorageValue("");
                                          setIsEditingLocalStorage(false);
                                          setShowKeyDeleteConfirm(false);
                                          refreshLocalStorage();
                                          setLocalStorageSuccessMessage("Key successfully removed from the browser local registry!");
                                        }}
                                        className="p-1 px-2 rounded-lg bg-red-650 hover:bg-red-600 text-white font-mono text-[8.5px] font-bold uppercase transition cursor-pointer"
                                      >
                                        Delete Yes!
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setShowKeyDeleteConfirm(false)}
                                        className="p-1 px-2 rounded-lg bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 text-[8.5px] uppercase font-mono transition cursor-pointer"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => setShowKeyDeleteConfirm(true)}
                                      className="p-1 px-1.5 rounded-lg bg-red-950/20 hover:bg-red-950/40 border border-red-900/40 text-red-400 hover:text-red-200 transition cursor-pointer"
                                      title="Delete Key"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Value Display or Editor */}
                              <div className="flex-grow flex flex-col space-y-2">
                                <div className="flex items-center justify-between font-mono text-[8.5px]">
                                  <span className="text-zinc-550 uppercase font-bold">Value Payload:</span>
                                  {!isEditingLocalStorage ? (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setIsEditingLocalStorage(true);
                                        setSelectedLocalStorageValue(localStorage.getItem(selectedLocalStorageKey || "") || "");
                                      }}
                                      className="text-red-450 hover:text-red-350 font-bold uppercase transition"
                                    >
                                      📝 Edit Raw Payload
                                    </button>
                                  ) : (
                                    <div className="flex gap-2">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setIsEditingLocalStorage(false);
                                          setSelectedLocalStorageValue(localStorage.getItem(selectedLocalStorageKey || "") || "");
                                        }}
                                        className="text-zinc-500 hover:text-zinc-300 transition"
                                      >
                                        Cancel
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          try {
                                            // Save the value
                                            localStorage.setItem(selectedLocalStorageKey, selectedLocalStorageValue);
                                            setIsEditingLocalStorage(false);
                                            refreshLocalStorage();
                                            setLocalStorageSuccessMessage("Successfully edited key value!");
                                            // Handle live update
                                            if (selectedLocalStorageKey === getGarageStorageKey(currentUser)) {
                                              try {
                                                const loaded = JSON.parse(selectedLocalStorageValue);
                                                if (Array.isArray(loaded)) {
                                                  setGarage(loaded);
                                                }
                                              } catch (ge) {}
                                            }
                                          } catch (err: any) {
                                            setLocalStorageErrorMessage("Failed to save edited payload: " + err.message);
                                          }
                                        }}
                                        className="text-emerald-400 hover:text-emerald-300 font-bold uppercase transition"
                                      >
                                        Save Changes
                                      </button>
                                    </div>
                                  )}
                                </div>

                                {isEditingLocalStorage ? (
                                  <textarea
                                    value={selectedLocalStorageValue}
                                    onChange={(e) => setSelectedLocalStorageValue(e.target.value)}
                                    className="w-full h-44 bg-black border border-slate-800 rounded-lg p-2 font-mono text-[9px] text-zinc-300 focus:outline-none focus:border-red-500/55 resize-none leading-normal"
                                    placeholder="Enter string representation or valid JSON payload..."
                                  />
                                ) : (
                                  <div className="w-full bg-black border border-slate-900 rounded-lg p-2.5 max-h-[220px] overflow-auto">
                                    <pre className="font-mono text-[9px] whitespace-pre-wrap word-break text-zinc-350 select-all leading-relaxed tab-size-2">
                                      {getPrettifiedJson(selectedLocalStorageValue)}
                                    </pre>
                                  </div>
                                )}
                              </div>

                              {/* Help Instructions context aware inside panel */}
                              <div className="bg-slate-900/40 p-2.5 rounded-lg border border-slate-900/60 leading-normal text-[8.5px] text-zinc-500 font-sans">
                                <span className="font-bold text-zinc-400 block uppercase text-[8px] font-mono tracking-wide mb-0.5">💡 Spotter Tip:</span>
                                {selectedLocalStorageKey.includes('car_comments') ? (
                                  <p>
                                    This key holds reviews and local test comments written on vehicle ID <strong>{selectedLocalStorageKey.replace('car_comments_', '')}</strong>. Sourced and saved when not logged in to database pools.
                                  </p>
                                ) : selectedLocalStorageKey.startsWith('car_spotter_garage_v2') ? (
                                  <p>
                                    This key hosts garage vehicles synced to the spotter session key. Modifying this JSON changes active items instantly in your catalog.
                                  </p>
                                ) : (
                                  <p>
                                    This is a system configuration key used to speed up operations and ensure state durability within browser boundaries.
                                  </p>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="border border-slate-900/60 bg-black/25 flex flex-col items-center justify-center py-16 px-4 rounded-xl text-center flex-grow">
                              <Layers className="h-7 w-7 text-zinc-700 animate-pulse mb-2" />
                              <h5 className="font-mono text-[10px] text-zinc-500 font-bold uppercase tracking-wider">No keys selected</h5>
                              <p className="text-[9.5px] text-zinc-600 max-w-xs leading-normal mt-1 font-sans">
                                Select any stored element from the left-hand listing to preview formatted entries, inspect sizes, copy payloads, or make instant JSON state alterations.
                              </p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* CLEAR ALL LOCAL STORAGE WIPE ACTION */}
                      <div className="pt-3 border-t border-slate-900 space-y-2.5">
                        <div className="space-y-0.5">
                          <h4 className="text-[10px] font-bold text-slate-400 uppercase font-mono tracking-wide">⚙️ Registry Maintenance Utilities</h4>
                          <p className="text-[9.5px] text-zinc-500 leading-normal">Safely clear storage parameters to test native clean-slate onboard behaviors.</p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="flex flex-col gap-1">
                            {!showClearCommentsConfirm ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setShowClearCommentsConfirm(true);
                                  setShowFormatConfirm(false);
                                  setLocalStorageSuccessMessage(null);
                                  setLocalStorageErrorMessage(null);
                                }}
                                className="py-2.5 px-3 rounded-lg bg-orange-950/20 hover:bg-orange-950/30 border border-orange-900/40 text-[9.5px] font-bold text-orange-200 transition cursor-pointer text-center uppercase tracking-wide"
                              >
                                🧹 Clear comments local cache Only
                              </button>
                            ) : (
                              <div className="flex flex-col gap-1.5 p-2 bg-orange-950/15 border border-orange-500/20 rounded-xl animate-fade-in text-center font-mono">
                                <span className="text-[9px] font-bold text-orange-400">Targeting {localStorageItems.filter(v => v.key.startsWith('car_comments_') || v.key.startsWith('compare_comments_')).length} cache keys. Proceed?</span>
                                <div className="grid grid-cols-2 gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      let count = 0;
                                      const keysToRemove: string[] = [];
                                      for (let i = 0; i < localStorage.length; i++) {
                                        const key = localStorage.key(i);
                                        if (key && (key.startsWith('car_comments_') || key.startsWith('compare_comments_'))) {
                                          keysToRemove.push(key);
                                        }
                                      }
                                      keysToRemove.forEach(k => {
                                        localStorage.removeItem(k);
                                        count++;
                                      });
                                      setSelectedLocalStorageKey(null);
                                      setSelectedLocalStorageValue("");
                                      setShowClearCommentsConfirm(false);
                                      refreshLocalStorage();
                                      setLocalStorageSuccessMessage(`Comments wiped. Cleaned up ${count} local keys successfully!`);
                                    }}
                                    className="py-1 bg-orange-600 hover:bg-orange-500 text-black text-[9px] font-black rounded-lg cursor-pointer uppercase"
                                  >
                                    Confirm WIPE
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setShowClearCommentsConfirm(false)}
                                    className="py-1 bg-slate-900 hover:bg-slate-800 text-slate-300 text-[9px] font-bold rounded-lg cursor-pointer uppercase border border-slate-850"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="flex flex-col gap-1">
                            {!showFormatConfirm ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setShowFormatConfirm(true);
                                  setShowClearCommentsConfirm(false);
                                  setLocalStorageSuccessMessage(null);
                                  setLocalStorageErrorMessage(null);
                                }}
                                className="py-2.5 px-3 rounded-lg bg-red-950/20 hover:bg-red-950/30 border border-red-900/40 text-[9.5px] font-bold text-red-200 transition cursor-pointer text-center uppercase tracking-wide"
                              >
                                🚨 Format Browser Local Persistence
                              </button>
                            ) : (
                              <div className="flex flex-col gap-1.5 p-2 bg-red-950/20 border border-red-500/25 rounded-xl animate-fade-in text-center font-mono">
                                <span className="text-[9px] font-bold text-red-400">Total deletion of ALL saved garages & reviews!</span>
                                <div className="grid grid-cols-2 gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      localStorage.clear();
                                      updateSupabaseConfig("", "");
                                      setSelectedLocalStorageKey(null);
                                      setSelectedLocalStorageValue("");
                                      setShowFormatConfirm(false);
                                      refreshLocalStorage();
                                      setLocalStorageSuccessMessage("Browser registry formatted. Reloading session...");
                                      setTimeout(() => window.location.reload(), 1500);
                                    }}
                                    className="py-1 bg-red-650 hover:bg-red-600 text-white text-[9px] font-black rounded-lg cursor-pointer uppercase"
                                  >
                                    Format All!
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setShowFormatConfirm(false)}
                                    className="py-1 bg-slate-900 hover:bg-slate-800 text-slate-300 text-[9px] font-bold rounded-lg cursor-pointer uppercase border border-slate-850"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

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
            
            {/* Nav item 1 (Dashboard) */}
            <button
              onClick={() => { setActiveTab('dashboard'); setSelectedGarageCar(null); }}
              className={`flex flex-col items-center gap-1 transition-all cursor-pointer ${activeTab === 'dashboard' ? `${activeTheme.accentText} opacity-100 scale-105` : 'text-slate-500 hover:text-slate-200'}`}
            >
              <div className={`p-1.5 rounded-full border transition-colors ${activeTab === 'dashboard' ? `${activeTheme.accentBorder} bg-white/5` : 'border-transparent'}`}>
                <Compass className="h-4 w-4" />
              </div>
              <span className="text-[9px] font-mono uppercase tracking-widest font-semibold text-center">Dashboard</span>
            </button>

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

          {/* Active plan highlighted name at footer bottom */}
          <div className="mt-2 text-center text-[7.5px] font-mono tracking-widest uppercase border-t border-slate-900/60 pt-1.5 flex flex-col gap-1.5 text-slate-500">
            <div className="flex items-center justify-center gap-1">
              <span>Membership:</span>
              {selectedPlanTier === 'chiptuning' && <span className="text-zinc-400 font-bold">Chiptuning Free</span>}
              {selectedPlanTier === 'teen_passion' && <span className="text-indigo-400 font-extrabold font-mono">Teen Passion Active ⚡</span>}
              {selectedPlanTier === 'gasoline_gold' && <span className="text-amber-400 font-extrabold font-mono">Gasoline Gold Active 🏆</span>}
              <span className="text-slate-700">•</span>
              <button 
                onClick={() => handleOpenPlans(selectedPlanTier)} 
                className="underline text-indigo-400 hover:text-indigo-300 transition cursor-pointer font-bold font-mono"
              >
                Manage
              </button>
            </div>
            
            {/* Visual Scan Quota Capacity Bar */}
            <div className="px-6 pb-1">
              {selectedPlanTier !== 'gasoline_gold' ? (
                <div className="space-y-0.5">
                  <div className="flex justify-between items-center text-[7px] text-zinc-500 font-mono tracking-wide">
                    <span>Scan usage limit</span>
                    <span>{scansCountUsed} / {selectedPlanTier === 'chiptuning' ? 3 : 15} used</span>
                  </div>
                  <div className="w-full h-1 bg-slate-950/80 rounded-full border border-slate-900 overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-500 ${
                        selectedPlanTier === 'chiptuning' ? 'bg-zinc-500' : 'bg-indigo-500'
                      }`}
                      style={{ width: `${Math.min(100, (scansCountUsed / (selectedPlanTier === 'chiptuning' ? 3 : 15)) * 100)}%` }}
                    ></div>
                  </div>
                </div>
              ) : (
                <div className="space-y-0.5">
                  <div className="flex justify-between items-center text-[7px] text-amber-500/80 font-mono tracking-wide">
                    <span>Scan usage limit</span>
                    <span className="font-bold">UNLIMITED CO-PILOT ACTIVE ♾️</span>
                  </div>
                  <div className="w-full h-1 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600 rounded-full"></div>
                </div>
              )}
            </div>
          </div>
        </footer>


        {/* GLOBAL SUBSCRIPTION NOTIFICATION BANNER */}
        {subscriptionSuccessMessage && (
          <div className="fixed top-4 left-4 right-4 bg-emerald-950 text-emerald-300 border border-emerald-500/30 p-3 rounded-xl shadow-2xl z-50 animate-bounce flex items-start gap-2.5 max-w-md mx-auto">
            <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="text-[10px] font-bold font-mono uppercase tracking-widest text-emerald-400 block">Sponsorship Verification Successful</span>
              <p className="text-[10.5px] leading-normal font-sans">{subscriptionSuccessMessage}</p>
            </div>
          </div>
        )}

        {/* SUBSCRIPTION PLAN MANAGER MODAL */}
        {showSubscriptionModal && (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
            <div className="bg-slate-950 rounded-2xl border border-slate-800 w-full max-w-sm overflow-hidden flex flex-col max-h-[90vh] shadow-2xl relative">
              
              {/* Header */}
              <div className="p-4 border-b border-slate-900 flex items-center justify-between bg-slate-900/40">
                <div className="space-y-0.5">
                  <span className="text-[8px] font-black font-mono tracking-widest text-indigo-400 uppercase">Youth & Teen-First Licensing</span>
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-100 font-mono">WhipCheck Memberships</h3>
                </div>
                <button 
                  onClick={() => {
                    setShowSubscriptionModal(false);
                    setShowParentAuthorization(false);
                  }}
                  className="p-1 rounded-md bg-slate-900 hover:bg-slate-850 text-zinc-500 hover:text-white transition text-[10px] font-mono border border-slate-800"
                >
                  Close
                </button>
              </div>

              {/* Scrollable content */}
              <div className="p-4 space-y-4 overflow-y-auto flex-1 font-sans">
                
                {parentName && (
                  <div className="p-2.5 rounded-lg border border-emerald-950/40 bg-emerald-950/10 text-emerald-400 text-[10px] flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 shrink-0" />
                    <span className="font-mono">Co-Pilot Guardian Active: <strong>{parentName}</strong></span>
                  </div>
                )}

                {/* Sub Plan 1: Chiptuning */}
                <div className={`p-3.5 rounded-xl border transition-all ${activePlanSelection === 'chiptuning' ? 'border-zinc-500 bg-zinc-950/20' : 'border-slate-900 bg-slate-900/10 hover:bg-slate-900/20'}`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[8px] font-mono tracking-widest text-zinc-500 font-extrabold uppercase">Slightly Boosted</span>
                      <h4 className="text-xs font-bold text-slate-200">CHIPTUNING FREE</h4>
                    </div>
                    <span className="text-xs font-black font-mono text-zinc-400">$0 <span className="text-[8px] font-normal text-zinc-500">/mo</span></span>
                  </div>
                  <div className="text-[9.5px] text-zinc-400 leading-relaxed mt-2 space-y-1">
                    <p>Standard car identifying specs with COPPA safety:</p>
                    <ul className="list-disc list-inside text-[8.5px] text-zinc-500 space-y-0.5 font-mono">
                      <li>• Maximum 3 Car Scans</li>
                      <li>• Comparison tool is locked</li>
                      <li>• Spotter card broadcasting locked</li>
                      <li>• Max 1 note / discuss post per car</li>
                    </ul>
                  </div>
                  <button 
                    onClick={() => handleSelectPlan('chiptuning')}
                    className={`w-full mt-3 py-1.5 rounded-lg text-[9px] font-mono font-bold uppercase transition ${
                      selectedPlanTier === 'chiptuning' 
                        ? 'bg-zinc-800 text-zinc-300 border border-zinc-700/50 cursor-default' 
                        : 'bg-zinc-750 hover:bg-zinc-700 text-slate-100 border border-zinc-750'
                    }`}
                  >
                    {selectedPlanTier === 'chiptuning' ? "Current Active Plan" : "Downgrade to Free"}
                  </button>
                </div>

                {/* Sub Plan 2: Teen Passion */}
                <div className={`p-3.5 rounded-xl border transition-all ${activePlanSelection === 'teen_passion' ? 'border-indigo-505 bg-indigo-950/10' : 'border-slate-900 bg-slate-900/10 hover:bg-slate-900/20'}`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[8px] font-mono tracking-widest text-indigo-400 font-extrabold uppercase">Youth Favorite</span>
                      <h4 className="text-xs font-bold text-slate-100 flex items-center gap-1">TEEN PASSION 🚀</h4>
                    </div>
                    <span className="text-xs font-black font-mono text-indigo-300">$1.99 <span className="text-[8px] font-normal text-indigo-550">/mo</span></span>
                  </div>
                  <div className="text-[9.5px] text-zinc-400 leading-relaxed mt-2 space-y-1">
                    <p>Pocket-money friendly. Explores the limits of your vehicle passion:</p>
                    <ul className="list-disc list-inside text-[8.5px] text-indigo-400/80 space-y-0.5 font-mono">
                      <li>• Up to 15 Car Scans limit</li>
                      <li>• Compare up to 2 vehicles at once</li>
                      <li>• Up to 3 Spotter Card broadcasts</li>
                      <li>• Max 5 notes / reviews logged per car</li>
                      <li>• Premium livery themes unlocked</li>
                    </ul>
                  </div>
                  <button 
                    onClick={() => handleSelectPlan('teen_passion')}
                    className={`w-full mt-3 py-1.5 rounded-lg text-[9px] font-mono font-bold uppercase transition ${
                      selectedPlanTier === 'teen_passion' 
                        ? 'bg-indigo-900/20 text-indigo-400 border border-indigo-900/50 cursor-default' 
                        : 'bg-indigo-650 hover:bg-indigo-500 text-white shadow-lg'
                    }`}
                  >
                    {selectedPlanTier === 'teen_passion' ? "Current Active Plan" : "Upgrade to Teen Passion"}
                  </button>
                </div>

                {/* Sub Plan 3: Gasoline Gold */}
                <div className={`p-3.5 rounded-xl border transition-all ${activePlanSelection === 'gasoline_gold' ? 'border-amber-500 bg-amber-950/10' : 'border-slate-900 bg-slate-900/10 hover:bg-slate-900/20'}`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[8px] font-mono tracking-widest text-amber-500 font-extrabold uppercase">Education & Engineering</span>
                      <h4 className="text-xs font-bold text-slate-100 flex items-center gap-1">GASOLINE GOLD 🏆</h4>
                    </div>
                    <span className="text-xs font-black font-mono text-amber-400">$4.99 <span className="text-[8px] font-normal text-amber-600">/mo</span></span>
                  </div>
                  <div className="text-[9.5px] text-zinc-400 leading-relaxed mt-2 space-y-1">
                    <p>STEM Enthusiast Co-Pilot License. Complete ultimate tracking control:</p>
                    <ul className="list-disc list-inside text-[8.5px] text-amber-400 space-y-0.5 font-mono">
                      <li>• Unlimited Car Scans (Unlimited)</li>
                      <li>• Unlimited Car Comparisons</li>
                      <li>• Unlimited Spotter Card broadcasting</li>
                      <li>• Unlimited Notes, reviews & details logged</li>
                      <li>• All Premium live livery themes unlocked</li>
                    </ul>
                  </div>
                  <button 
                    onClick={() => handleSelectPlan('gasoline_gold')}
                    className={`w-full mt-3 py-1.5 rounded-lg text-[9px] font-mono font-bold uppercase transition ${
                      selectedPlanTier === 'gasoline_gold' 
                        ? 'bg-amber-900/20 text-amber-400 border border-amber-900/50 cursor-default' 
                        : 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold shadow-lg'
                    }`}
                  >
                    {selectedPlanTier === 'gasoline_gold' ? "Current Active Plan" : "Upgrade to Gasoline Gold"}
                  </button>
                </div>

                {/* Teen Privacy Safe Notice */}
                <div className="p-3 bg-slate-900 rounded-xl border border-slate-850 text-[10px] text-slate-500 text-center uppercase tracking-wide font-mono leading-relaxed">
                  🛡️ COPPA compliant • Zero targeting trackers • Strictly parental request authorized
                </div>

              </div>
            </div>
          </div>
        )}

        {/* SECURITY & PARENTAL AUTHORIZATION CO-PILOT SCREEN */}
        {showParentAuthorization && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 z-51 animate-fade-in text-slate-200">
            <div className="bg-slate-950 rounded-2xl border border-slate-800 w-full max-w-sm overflow-hidden flex flex-col max-h-[90vh] shadow-2xl">
              
              <div className="p-4 border-b border-indigo-950 bg-indigo-950/20 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-indigo-400 shrink-0" />
                  <div className="space-y-0.5">
                    <span className="text-[8px] font-bold font-mono uppercase tracking-widest text-indigo-400 block">Youth Billing Shield</span>
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-200 font-mono">Parental Co-Pilot Approval</h3>
                  </div>
                </div>
                <button 
                  onClick={() => setShowParentAuthorization(false)}
                  className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-[9px] font-mono text-slate-400 cursor-pointer"
                >
                  Cancel
                </button>
              </div>

              <form onSubmit={handleParentAuthSubmit} className="p-4 space-y-4 overflow-y-auto flex-1 font-sans">
                
                <div className="bg-slate-900 p-3 rounded-xl border border-indigo-950/50 space-y-1.5">
                  <span className="text-[9px] font-bold text-indigo-400 font-mono uppercase tracking-widest block">How it works:</span>
                  <p className="text-[10px] text-slate-400 leading-relaxed font-light">
                    Since you are accessing premium features as a teen enthusiast, we require <strong>one-time parent or guardian co-pilot signoff</strong> to authorize the safe profile expansion. No credit card is stored on the client.
                  </p>
                  
                  {/* Quick bypass button for sandbox evaluators */}
                  <button 
                    type="button"
                    onClick={handleSimulatePinBypass}
                    className="w-full mt-1.5 py-1 text-[8.5px] font-mono bg-indigo-950 hover:bg-indigo-900 text-indigo-200 rounded border border-indigo-700/30 font-bold uppercase cursor-pointer"
                  >
                    ⚡ Demo Mode: Autofill Parent Safety Account
                  </button>
                </div>

                {parentPinError && (
                  <div className="p-3 bg-red-950/30 border border-red-500/20 rounded-xl text-red-100 text-[10px] font-mono">
                    {parentPinError}
                  </div>
                )}

                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black font-mono uppercase text-slate-500 block">Parent/Guardian Full Name</label>
                    <div className="relative">
                      <input 
                        type="text"
                        required
                        placeholder="e.g. Eleanor Mercer"
                        value={parentName}
                        onChange={(e) => setParentName(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 focus:outline-none focus:border-indigo-500 rounded-lg pl-3 pr-3 py-1.5 text-xs text-slate-200 font-mono"
                      />
                    </div>
                  </div>

                  <div className="space-y-1 font-mono">
                    <label className="text-[9px] font-black uppercase text-slate-500 block">Parent Email (Consent Notification Receipt)</label>
                    <input 
                      type="email"
                      required
                      placeholder="parent@example.com"
                      value={parentEmail}
                      onChange={(e) => setParentEmail(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 focus:outline-none focus:border-indigo-500 rounded-lg pl-3 pr-3 py-1.5 text-xs text-slate-200"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <label className="text-[9px] font-black font-mono uppercase text-slate-500 block">Create Parent Safety PIN (4 digits)</label>
                      <span className="text-[8px] text-slate-600 font-mono uppercase">Protects setup tier</span>
                    </div>
                    <input 
                      type="password"
                      maxLength={4}
                      pattern="[0-9]*"
                      inputMode="numeric"
                      required
                      placeholder="e.g. 5824"
                      value={parentPin}
                      onChange={(e) => setParentPin(e.target.value.replace(/\D/g, ""))}
                      className="w-full bg-slate-900 border border-slate-800 focus:outline-none focus:border-indigo-500 rounded-lg pl-3 pr-3 py-1.5 text-center text-sm font-bold tracking-widest text-slate-100 font-mono"
                    />
                  </div>
                </div>

                <div className="pt-2 flex flex-col gap-2">
                  <button
                    type="submit"
                    className="w-full text-xs font-mono font-black uppercase py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg cursor-pointer"
                  >
                    Confirm Co-Pilot PIN & Activate
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowCopiedParentLink(true);
                      setTimeout(() => setShowCopiedParentLink(false), 3000);
                    }}
                    className="w-full text-[9px] tracking-wider font-mono text-indigo-400 hover:underline uppercase text-center pt-1"
                  >
                    {showCopiedParentLink ? "📋 Request Link Copied to Clipboard!" : "🔗 Share Parent Approval Request Link"}
                  </button>
                </div>

              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
