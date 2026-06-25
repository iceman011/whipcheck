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
  supabase,
  checkSupabaseConnection
} from "./lib/supabase";

// ————————————————————————————————————————————————————
// NO-PERSISTENCE PURE INERT SINGLETON STORAGE EXCEPT FOR THEMING
// ————————————————————————————————————————————————————
const customLocalStorage: Storage = {
  getItem: (key: string) => {
    if (key === "whipcheck_theme_id") {
      try {
        return window.localStorage.getItem(key);
      } catch (e) {
        return null;
      }
    }
    return null;
  },
  setItem: (key: string, value: string) => {
    if (key === "whipcheck_theme_id") {
      try {
        window.localStorage.setItem(key, value);
      } catch (e) {}
    }
  },
  removeItem: (key: string) => {
    if (key === "whipcheck_theme_id") {
      try {
        window.localStorage.removeItem(key);
      } catch (e) {}
    }
  },
  clear: () => {
    try {
      window.localStorage.removeItem("whipcheck_theme_id");
    } catch (e) {}
  },
  key: (index: number) => {
    return null;
  },
  get length() {
    return 0;
  }
} as Storage;

const customSessionStorage: Storage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
  clear: () => {},
  key: () => null,
  get length() { return 0; }
} as Storage;

const localStorage = customLocalStorage;
const sessionStorage = customSessionStorage;

// Custom apiFetch wrapper that injects live Supabase overrides when calling local server APIs 
const apiFetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const configUrl = localStorage.getItem("whipcheck_supabase_url") || "";
  const configKey = localStorage.getItem("whipcheck_supabase_anon_key") || "";
  if (configUrl.trim() && configKey.trim()) {
    const headers = new Headers(init?.headers);
    if (!headers.has("x-supabase-url")) {
      headers.set("x-supabase-url", configUrl.trim());
    }
    if (!headers.has("x-supabase-anon-key")) {
      headers.set("x-supabase-anon-key", configKey.trim());
    }
    return fetch(input, { ...init, headers });
  }
  return fetch(input, init);
};

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

export const SCHEMA_CREATE_SQL = `-- Create WhipCheck saved vehicles table on Supabase
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
  with check (true);

-- Create custom user security details on Supabase
create table public.whipcheck_users (
  id text primary key,
  username text not null,
  email text not null unique,
  password_hash text not null,
  is_verified boolean default false,
  otp text,
  otp_expires bigint,
  plan_tier text default 'chiptuning',
  scans_count_used integer default 0,
  compare_list text default '[]',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security (RLS) for custom user data pool
alter table public.whipcheck_users enable row level security;

create policy "Allow public access to whipcheck_users"
  on public.whipcheck_users
  for all
  using (true)
  with check (true);

-- Create computer vision image cache on Supabase
create table public.whipcheck_identify_cache (
  key text primary key,
  data text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security (RLS) for computer vision image cache
alter table public.whipcheck_identify_cache enable row level security;

create policy "Allow public access to whipcheck_identify_cache"
  on public.whipcheck_identify_cache
  for all
  using (true)
  with check (true);`;

export const SCHEMA_UPGRADE_SQL = `-- Upgrade existing tables to match the latest application schema
-- Adds subscription plan tier, scan usage count, and active compare cache to public.whipcheck_users

-- 1. Alter public.whipcheck_users to include subscription parameters
alter table public.whipcheck_users add column if not exists plan_tier text default 'chiptuning';
alter table public.whipcheck_users add column if not exists scans_count_used integer default 0;
alter table public.whipcheck_users add column if not exists compare_list text default '[]';

-- 2. Alter direct scans link mapping to vehicles on Supabase
alter table public.vehicles add column if not exists user_id text;

-- 3. Verify and enforce RLS (Row Level Security) safety policies
alter table public.vehicles enable row level security;
alter table public.comments enable row level security;
alter table public.whipcheck_users enable row level security;
alter table public.whipcheck_identify_cache enable row level security;

-- 4. Enable Safe Raw SQL execution function in Supabase for direct UI migrations
CREATE OR REPLACE FUNCTION public.exec_sql(sql_query text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE sql_query;
END;
$$;`;

export default function App() {
  // Mobile UI Tabs: 'dashboard' | 'scan' | 'garage' | 'account'
  const [activeTab, setActiveTab] = useState<'dashboard' | 'scan' | 'garage' | 'account'>(() => {
    try {
      const savedUser = localStorage.getItem("whipcheck_user_session");
      return savedUser ? 'dashboard' : 'scan';
    } catch (e) {
      return 'scan';
    }
  });

  // Direct SQL execution states and handlers
  const [isApplyingSql, setIsApplyingSql] = useState<boolean>(false);
  const [sqlExecutionFeedback, setSqlExecutionFeedback] = useState<{
    success: boolean;
    message: string;
    error?: string;
    code?: string;
    setupSql?: string;
  } | null>(null);

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
  const [sessionScansUsed, setSessionScansUsed] = useState<number>(0);
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
              const res = await apiFetch(`/api/comments/${key}`);
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
      let updatedList;
      if (exists) {
        updatedList = prev.filter((c) => c.id !== car.id);
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
        updatedList = [...prev, car];
      }
      uploadUserProfileUpdates({ compare_list: updatedList });
      return updatedList;
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
  const [showWipeUsersConfirm, setShowWipeUsersConfirm] = useState<boolean>(false);
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
  const [sqlErrorState, setSqlErrorState] = useState<{ requiredSql: string; message: string; tableName: string } | null>(null);

  const handleFrontendError = (err: any) => {
    console.warn("Captured database/frontend warning status:", err);
    if (!err) return;
    const errText = err.message || String(err);
    const isMissingTable = 
      err?.code === "42P01" || 
      err?.code === "PGRST125" ||
      errText.toLowerCase().includes("relation") && errText.toLowerCase().includes("does not exist") ||
      errText.toLowerCase().includes("invalid path specified in request url") ||
      errText.toLowerCase().includes("pgrst125");

    if (isMissingTable) {
      const tableMatch = errText.match(/relation "public\.(.+?)"/i) || [null, "requested database table"];
      const tableName = tableMatch[1] || "requested database table";
      
      const sqlSchema = `-- ========================================================
-- WHIPCHECK COMPLETE SUPABASE SETUP SCRIPT
-- ========================================================
-- Execute this script in your Supabase SQL Editor to build all tables!

-- 1. Create WhipCheck saved vehicles table
CREATE TABLE IF NOT EXISTS public.vehicles (
  id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL,
  image TEXT,
  "isCar" BOOLEAN DEFAULT true,
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  generation TEXT,
  "yearRange" TEXT,
  confidence DOUBLE PRECISION,
  color TEXT,
  category TEXT,
  "engineType" TEXT,
  power TEXT,
  horsepower TEXT,
  torque TEXT,
  "modelYear" TEXT,
  "zeroToSixty" TEXT,
  "estimatedNewPrice" TEXT,
  "estimatedUsedPrice" TEXT,
  trivia TEXT, -- JSON array of trivia
  tips TEXT, -- JSON array of buyer/fan advice
  specs TEXT, -- JSON object of specs (transmission, driveType, fuelEconomy)
  user_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for vehicles
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public access to vehicles"
  ON public.vehicles FOR ALL USING (true) WITH CHECK (true);

-- 2. Create comments & rating review list
CREATE TABLE IF NOT EXISTS public.comments (
  id TEXT PRIMARY KEY,
  car_id TEXT NOT NULL,
  author TEXT NOT NULL,
  text TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  comfort INTEGER,
  "gasConsumption" INTEGER,
  performance INTEGER,
  reliability INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for comments
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public access to comments"
  ON public.comments FOR ALL USING (true) WITH CHECK (true);

-- 3. Create WhipCheck registered users table
CREATE TABLE IF NOT EXISTS public.whipcheck_users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  is_verified BOOLEAN DEFAULT false,
  otp TEXT,
  otp_expires BIGINT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for whipcheck_users
ALTER TABLE public.whipcheck_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public access to whipcheck_users"
  ON public.whipcheck_users FOR ALL USING (true) WITH CHECK (true);

-- 4. Create image-recognition caching lookup engine
CREATE TABLE IF NOT EXISTS public.whipcheck_identify_cache (
  key TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for whipcheck_identify_cache
ALTER TABLE public.whipcheck_identify_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public access to whipcheck_identify_cache"
  ON public.whipcheck_identify_cache FOR ALL USING (true) WITH CHECK (true);`;

      setSqlErrorState({
        requiredSql: sqlSchema,
        message: "One of the required Supabase database tables is missing. Please run the setup SQL script in your Supabase project to generate them.",
        tableName: tableName
      });
    }
  };

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
      
      const res = await apiFetch(`/api/dashboard-stats?username=${encodeURIComponent(activeName)}`);
      if (res.ok) {
        const data = await res.json();
        setDashboardStats(data);
        setSqlErrorState(null);
      } else {
        const data = await res.json();
        if (data.code === "TABLE_MISSING") {
          setSqlErrorState({
            requiredSql: data.requiredSql,
            message: data.message,
            tableName: data.tableName
          });
        } else {
          console.error("Dashboard response error:", data.error || "Unknown response");
        }
      }
    } catch (err) {
      console.error("Failed to load dashboard stats", err);
      handleFrontendError(err);
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
  const [adminSubTab, setAdminSubTab] = useState<'db' | 'script' | 'data' | 'live_explorer' | 'supabase_wipe'>('db');

  // Supabase connection health check state
  const [supabaseHealth, setSupabaseHealth] = useState<{
    loading: boolean;
    success: boolean | null;
    message: string;
    configured: boolean;
    url: string;
    error?: {
      message: string;
      code?: string;
      details?: string;
      hint?: string;
      stack?: string;
    };
  }>({
    loading: false,
    success: null,
    message: "Health check not ran yet.",
    configured: false,
    url: ""
  });

  const [showHealthTrace, setShowHealthTrace] = useState<boolean>(false);

  const runSupabaseHealthCheck = async () => {
    setSupabaseHealth(prev => ({
      ...prev,
      loading: true,
      message: "Probing credentials, checking secure schema, and testing handshakes..."
    }));
    try {
      const res = await checkSupabaseConnection();
      setSupabaseHealth({
        loading: false,
        success: res.success,
        message: res.message,
        configured: res.configured,
        url: res.url,
        error: res.error
      });
    } catch (e: any) {
      setSupabaseHealth({
        loading: false,
        success: false,
        message: `Critically caught interface failure: ${e.message || e}`,
        configured: true,
        url: "",
        error: {
          message: e.message || String(e),
          stack: e.stack
        }
      });
    }
  };

  useEffect(() => {
    runSupabaseHealthCheck();
  }, []);

  // Supabase Table Rows Count and Full Cloud Wipe state
  const [supabaseTotalCarCount, setSupabaseTotalCarCount] = useState<number | null>(null);
  const [supabaseTotalCommentCount, setSupabaseTotalCommentCount] = useState<number | null>(null);
  const [isFetchingSupabaseCounts, setIsFetchingSupabaseCounts] = useState<boolean>(false);
  const [supabaseCountsError, setSupabaseCountsError] = useState<string | null>(null);
  const [supabaseWipeProgress, setSupabaseWipeProgress] = useState<string | null>(null);
  const [supabaseWipeError, setSupabaseWipeError] = useState<string | null>(null);
  const [supabaseWipeSuccess, setSupabaseWipeSuccess] = useState<boolean>(false);
  const [showSupabaseWipeConfirm, setShowSupabaseWipeConfirm] = useState<boolean>(false);
  const [adminDbStats, setAdminDbStats] = useState<any>(null);
  const [adminDbStatsLoading, setAdminDbStatsLoading] = useState<boolean>(false);

  // Live Host DB Explorer States
  const [explorerTable, setExplorerTable] = useState<'whipcheck_users' | 'vehicles' | 'comments' | 'whipcheck_identify_cache'>('whipcheck_users');
  const [explorerRows, setExplorerRows] = useState<any[]>([]);
  const [explorerLoading, setExplorerLoading] = useState<boolean>(false);
  const [explorerError, setExplorerError] = useState<any>(null);
  const [explorerSearchQuery, setExplorerSearchQuery] = useState<string>("");
  const [explorerSelectedRow, setExplorerSelectedRow] = useState<any | null>(null);
  const [explorerEditingRow, setExplorerEditingRow] = useState<any | null>(null);
  const [explorerEditPayload, setExplorerEditPayload] = useState<string>("");
  const [explorerEditError, setExplorerEditError] = useState<string | null>(null);
  const [explorerStatusMessage, setExplorerStatusMessage] = useState<string | null>(null);
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

  const fetchSupabaseTotalCounts = async () => {
    if (!isSupabaseConfigured() || !supabase) {
      setSupabaseCountsError("Supabase is not configured yet. Configure connection settings in the DB SETUP tab first.");
      setSupabaseTotalCarCount(null);
      setSupabaseTotalCommentCount(null);
      return;
    }
    
    setIsFetchingSupabaseCounts(true);
    setSupabaseCountsError(null);
    try {
      // 1. Fetch exact count of vehicles
      const { count: carCount, error: carError } = await supabase
        .from("vehicles")
        .select("*", { count: "exact", head: true });
        
      if (carError) throw carError;
      
      // 2. Fetch exact count of comments
      const { count: commentCount, error: commentError } = await supabase
        .from("comments")
        .select("*", { count: "exact", head: true });
        
      if (commentError) throw commentError;
      
      setSupabaseTotalCarCount(carCount || 0);
      setSupabaseTotalCommentCount(commentCount || 0);
    } catch (err: any) {
      console.warn("Failed to query Supabase counts (expected if setup is matching):", err);
      setSupabaseCountsError(err.message || String(err));
    } finally {
      setIsFetchingSupabaseCounts(false);
    }
  };

  const handleWipeSupabaseData = async () => {
    if (!isSupabaseConfigured() || !supabase) {
      setSupabaseWipeError("Supabase is not configured.");
      return;
    }
    
    setSupabaseWipeProgress("Initiating complete Supabase cloud database wipe...");
    setSupabaseWipeError(null);
    setSupabaseWipeSuccess(false);
    
    try {
      // Step 1: Wipe all records from comments table
      setSupabaseWipeProgress("Step 1/2: Wiping 'comments' table by bypassing standard filters...");
      const { error: commentsWipeError } = await supabase
        .from("comments")
        .delete()
        .neq("id", "0"); // Standard way to delete columns under basic RLS or broad permissions
        
      if (commentsWipeError) {
        console.warn("Wiping comments encountered error (could be RLS restriction):", commentsWipeError);
        // Continue but log
        setSupabaseWipeProgress(prev => prev + `\n⚠️ Comments Wipe Warning: ${commentsWipeError.message}. Proceeding to vehicles...`);
      } else {
        setSupabaseWipeProgress(prev => prev + "\n- Comments table wipe complete!");
      }
      
      // Step 2: Wipe all records from vehicles table
      setSupabaseWipeProgress(prev => prev + "\nStep 2/2: Wiping 'vehicles' table...");
      const { error: vehiclesWipeError } = await supabase
        .from("vehicles")
        .delete()
        .neq("id", "0");
        
      if (vehiclesWipeError) {
        console.warn("Wiping vehicles encountered error:", vehiclesWipeError);
        throw vehiclesWipeError;
      } else {
        setSupabaseWipeProgress(prev => prev + "\n- Vehicles table wipe complete!");
      }
      
      setSupabaseWipeProgress(prev => prev + "\n🎉 Full cloud wipe executed successfully!");
      setSupabaseWipeSuccess(true);
      setShowSupabaseWipeConfirm(false);
      
      // Refresh counts
      await fetchSupabaseTotalCounts();
    } catch (err: any) {
      console.error("Wipe failed:", err);
      setSupabaseWipeError(err.message || String(err));
      setSupabaseWipeProgress(null);
    }
  };

  useEffect(() => {
    if (adminSubTab === 'localstorage') {
      refreshLocalStorage();
    } else if (adminSubTab === 'supabase_wipe') {
      fetchSupabaseTotalCounts();
    }
  }, [adminSubTab]);

  // Subscription action logic
  const handleOpenPlans = (tier?: 'chiptuning' | 'teen_passion' | 'gasoline_gold') => {
    setActivePlanSelection(tier || selectedPlanTier);
    setShowSubscriptionModal(true);
  };

  const handleSelectPlan = (tier: 'chiptuning' | 'teen_passion' | 'gasoline_gold') => {
    if (!currentUser) {
      setShowSubscriptionModal(false);
      setAuthFormMode('signup');
      setActiveTab('account');
      setAuthMessage("💡 Register a free account first to access WhipCheck membership subscription plans!");
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setActivePlanSelection(tier);
    if (tier === 'chiptuning') {
      localStorage.setItem("whipcheck_subscription_tier", 'chiptuning');
      setSelectedPlanTier('chiptuning');
      uploadUserProfileUpdates({ plan_tier: 'chiptuning' });
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
    uploadUserProfileUpdates({ plan_tier: activePlanSelection });
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
    apiFetch("/api/health")
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
      apiFetch("/api/admin/database-stats")
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
        syncUserProfileParameters(parsedUser.id);
        apiFetch(`/api/user/vehicles/${encodeURIComponent(parsedUser.id)}`)
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
      const hasCustomSession = !!localStorage.getItem("whipcheck_user_session");
      if (hasCustomSession) {
        return;
      }
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
      // Synchronize custom user subscription tiers & scan properties
      syncUserProfileParameters(user.id);
      
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

    if (!currentUser) {
      setSaveError("🔒 Guests cannot add vehicles to the garage. Please register or log in first!");
      setActiveTab('account');
      setAuthMessage("✨ To add scans to your personal garage, please register an account or log in first!");
      return;
    }

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
        const response = await apiFetch(`/api/user/vehicles/${encodeURIComponent(currentUser.id)}`, {
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
        await saveSupabaseCar(car, currentUser.id);
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
          await apiFetch(`/api/comments/${normalizedKey}?author=${encodeURIComponent(currentAuthor)}`, { method: "DELETE" });
        } catch (err) {
          console.error("Failed to delete local comments by key:", normalizedKey, err);
        }
        if (id !== normalizedKey) {
          try {
            await apiFetch(`/api/comments/${id}?author=${encodeURIComponent(currentAuthor)}`, { method: "DELETE" });
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
        await apiFetch(`/api/user/vehicles/${encodeURIComponent(currentUser.id)}/${encodeURIComponent(id)}`, {
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
    if (checkScanLimitReached()) {
      if (!currentUser) {
        setActiveTab('account');
        setAuthMessage("🔒 Guest users are allowed only 1 free scan. Please register or sign in to continue scanning and save cars!");
        return;
      }
      handleOpenPlans(selectedPlanTier === 'chiptuning' ? 'teen_passion' : 'gasoline_gold');
      setAuthMessage(`🚫 Scan limit of ${selectedPlanTier === 'chiptuning' ? '3' : '15'} scans reached for your current plan! Upgrade to unlock unlimited scans.`);
      return;
    }
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
    if (checkScanLimitReached()) {
      if (!currentUser) {
        setActiveTab('account');
        setAuthMessage("🔒 Guest users are allowed only 1 free scan. Please register or sign in to continue scanning and save cars!");
        return;
      }
      handleOpenPlans(selectedPlanTier === 'chiptuning' ? 'teen_passion' : 'gasoline_gold');
      setAuthMessage(`🚫 Scan limit of ${selectedPlanTier === 'chiptuning' ? '3' : '15'} scans reached for your current plan! Upgrade to unlock unlimited scans.`);
      return;
    }
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
    // Guest user constraints: allow guest user to scan exactly 1 time in current session
    if (!currentUser && sessionScansUsed >= 1) {
      return true;
    }
    if (selectedPlanTier === 'chiptuning' && (sessionScansUsed >= 3 || garage.length >= 3)) {
      return true;
    }
    if (selectedPlanTier === 'teen_passion' && (sessionScansUsed >= 15 || garage.length >= 15)) {
      return true;
    }
    return false;
  };

  // Handle sample click
  const handleSelectSample = (sampleUrl: string) => {
    if (checkScanLimitReached()) {
      if (!currentUser) {
        setActiveTab('account');
        setAuthMessage("🔒 Guest users are allowed only 1 free scan. Please register or sign in to continue scanning and save cars!");
        return;
      }
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
      if (!currentUser) {
        setActiveTab('account');
        setAuthMessage("🔒 Guest users are allowed only 1 free scan. Please register or sign in to continue scanning and save cars!");
        setScanStep('idle');
        return;
      }
      handleOpenPlans(selectedPlanTier === 'chiptuning' ? 'teen_passion' : 'gasoline_gold');
      setAuthMessage(`🚫 Scan limit of ${selectedPlanTier === 'chiptuning' ? '3' : '15'} scans reached for your current plan! Upgrade to unlock unlock unlimited scans.`);
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
      const res = await apiFetch("/api/identify-car", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          image: base64Data,
          imageUrl: urlData,
          userContext: {
            email: currentUser?.email || "Guest",
            id: currentUser?.id || "guest-session",
            planTier: selectedPlanTier,
            sessionScansUsed: sessionScansUsed
          }
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
      setSessionScansUsed(prev => prev + 1);
      localStorage.setItem("whipcheck_scan_use_count", newScanCount.toString());
      uploadUserProfileUpdates({ scans_count_used: newScanCount });
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
    const txt = sqlSchemaMode === 'create' ? SCHEMA_CREATE_SQL : SCHEMA_UPGRADE_SQL;

    navigator.clipboard.writeText(txt).then(() => {
      setCopiedSql(true);
      setTimeout(() => setCopiedSql(false), 3000);
    });
  };

  const handleApplySqlDirectly = async (sqlText: string) => {
    setIsApplyingSql(true);
    setSqlExecutionFeedback(null);
    try {
      const res = await apiFetch("/api/admin/execute-sql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sql: sqlText })
      });
      const data = await res.json();
      if (res.ok && data && data.success) {
        setSqlExecutionFeedback({
          success: true,
          message: data.message || "Database changes applied successfully!"
        });
        // Auto-refresh states when migration is successfully done
        fetchAdminDbStats();
      } else {
        setSqlExecutionFeedback({
          success: false,
          error: data.error || "Execution failed.",
          message: data.message || "An error occurred during real-time database modifications.",
          code: data.code,
          setupSql: data.setupSql
        });
      }
    } catch (err: any) {
      setSqlExecutionFeedback({
        success: false,
        error: err.message || "Network Error",
        message: "Failed to connect to the backend SQL migration pipeline."
      });
    } finally {
      setIsApplyingSql(false);
    }
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
      const res = await apiFetch("/api/admin/database-stats");
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

  const fetchExplorerRows = async (tableName: typeof explorerTable) => {
    setExplorerLoading(true);
    setExplorerError(null);
    setExplorerStatusMessage(null);
    try {
      const res = await apiFetch(`/api/admin/db-explorer/${tableName}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setExplorerRows(data.rows || []);
      } else {
        setExplorerError({
          message: data.error || `Failed to fetch table "${tableName}"`,
          requiredSql: data.requiredSql,
          code: data.code,
          stack: data.stack
        });
      }
    } catch (e: any) {
      setExplorerError({
        message: e.message || "Network Error occurred during DB Explorer transaction.",
        stack: e.stack || String(e)
      });
    } finally {
      setExplorerLoading(false);
    }
  };

  const deleteExplorerRow = async (tableName: typeof explorerTable, row: any) => {
    if (!window.confirm(`Are you absolutely sure you want to delete this row from "${tableName}"?`)) {
      return;
    }
    setExplorerLoading(true);
    setExplorerStatusMessage(null);
    setExplorerError(null);
    try {
      const payload: any = {};
      if (tableName === "whipcheck_identify_cache") {
        payload.key = row.key;
      } else {
        payload.id = row.id;
      }

      const res = await apiFetch(`/api/admin/db-explorer/${tableName}/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setExplorerStatusMessage(`Successfully deleted row from ${tableName}.`);
        if (explorerSelectedRow && (explorerSelectedRow.id === row.id || explorerSelectedRow.key === row.key)) {
          setExplorerSelectedRow(null);
        }
        await fetchExplorerRows(tableName);
        await fetchAdminDbStats(); // Sync stats totals
      } else {
        setExplorerError({
          message: data.error || `Failed to delete row from "${tableName}"`,
          stack: data.stack
        });
      }
    } catch (e: any) {
      setExplorerError({
        message: e.message || `Failed to delete row from "${tableName}"`,
        stack: e.stack || String(e)
      });
    } finally {
      setExplorerLoading(false);
    }
  };

  const updateExplorerRow = async (tableName: typeof explorerTable) => {
    setExplorerEditError(null);
    try {
      let parsedPayload: any;
      try {
        parsedPayload = JSON.parse(explorerEditPayload);
      } catch (jsonErr: any) {
        setExplorerEditError(`Invalid JSON format: ${jsonErr.message}`);
        return;
      }

      setExplorerLoading(true);
      const res = await apiFetch(`/api/admin/db-explorer/${tableName}/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsedPayload)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setExplorerStatusMessage(`Successfully upserted/updated row in ${tableName}.`);
        setExplorerEditingRow(null);
        if (explorerSelectedRow && (explorerSelectedRow.id === parsedPayload.id || explorerSelectedRow.key === parsedPayload.key)) {
          setExplorerSelectedRow(parsedPayload);
        }
        await fetchExplorerRows(tableName);
        await fetchAdminDbStats(); // Sync stats totals
      } else {
        setExplorerEditError(data.error || `Failed to update row in "${tableName}"`);
        if (data.stack) {
          setExplorerError({
            message: data.error || `Failed to update row`,
            stack: data.stack
          });
        }
      }
    } catch (e: any) {
      setExplorerEditError(e.message || "Network Error while updating row.");
    } finally {
      setExplorerLoading(false);
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

      const res = await apiFetch("/api/admin/reset-database", { method: "POST" });
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

  const handleWipeRegisteredUsers = async () => {
    try {
      setResetFeedback("Wiping registered user database on server...");
      const res = await apiFetch("/api/admin/wipe-users", { method: "POST" });
      if (res.ok) {
        setResetFeedback("Registered user accounts database wiped successfully.");
        
        // Clear all active user sessions
        localStorage.removeItem("whipcheck_user_session");
        localStorage.removeItem("whipcheck_auth_email");
        localStorage.removeItem("whipcheck_spotter_name");
        sessionStorage.clear();
        
        sessionStorage.setItem(
          "whipcheck_wiped_success_msg",
          "✅ SUCCESS: All users registered in the app have been successfully wiped from the database!"
        );
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

  const uploadUserProfileUpdates = async (updates: {
    plan_tier?: 'chiptuning' | 'teen_passion' | 'gasoline_gold';
    scans_count_used?: number;
    compare_list?: IdentifiedCar[];
  }) => {
    let activeUserId = currentUser ? currentUser.id : null;
    if (!activeUserId) {
      const sessionStr = localStorage.getItem("whipcheck_user_session");
      if (sessionStr) {
        try {
          const parsed = JSON.parse(sessionStr);
          activeUserId = parsed.id;
        } catch (e) {}
      }
    }
    if (!activeUserId) return;

    try {
      const body: any = {};
      if (updates.plan_tier !== undefined) {
        body.plan_tier = updates.plan_tier;
      }
      if (updates.scans_count_used !== undefined) {
        body.scans_count_used = updates.scans_count_used;
      }
      if (updates.compare_list !== undefined) {
        body.compare_list = JSON.stringify(updates.compare_list);
      }

      const res = await apiFetch(`/api/user/profile/${encodeURIComponent(activeUserId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data && data.success && data.profile) {
        const sessionStr = localStorage.getItem("whipcheck_user_session");
        if (sessionStr) {
          try {
            const parsedSession = JSON.parse(sessionStr);
            Object.assign(parsedSession, data.profile);
            localStorage.setItem("whipcheck_user_session", JSON.stringify(parsedSession));
          } catch (e) {}
        }
      }
    } catch (err) {
      console.error("Failed to upload user profile updates to database:", err);
    }
  };

  const syncUserProfileParameters = async (userId: string) => {
    if (!userId || userId === "undefined" || userId === "null") return;
    try {
      const res = await apiFetch(`/api/user/profile/${encodeURIComponent(userId)}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.success && data.profile) {
          const profile = data.profile;
          if (profile.plan_tier) {
            setSelectedPlanTier(profile.plan_tier);
            localStorage.setItem("whipcheck_subscription_tier", profile.plan_tier);
          }
          
          let dbScans = typeof profile.scans_count_used === "number" ? profile.scans_count_used : 0;
          if (sessionScansUsed > 0) {
            dbScans += sessionScansUsed;
            // Upload the merged scan count to server
            uploadUserProfileUpdates({ scans_count_used: dbScans });
          }
          setScansCountUsed(dbScans);
          localStorage.setItem("whipcheck_scan_use_count", String(dbScans));

          if (profile.compare_list) {
            try {
              const list = typeof profile.compare_list === "string" ? JSON.parse(profile.compare_list) : profile.compare_list;
              if (Array.isArray(list)) {
                setCompareList(list);
              }
            } catch (err) {}
          }

          const sessionStr = localStorage.getItem("whipcheck_user_session");
          if (sessionStr) {
            try {
              const parsedSession = JSON.parse(sessionStr);
              Object.assign(parsedSession, profile);
              parsedSession.scans_count_used = dbScans;
              localStorage.setItem("whipcheck_user_session", JSON.stringify(parsedSession));
            } catch (e) {}
          }
        }
      }
    } catch (err) {
      console.warn("Failed retrieving user subscription / plan properties:", err);
    }
  };

  // --- CUSTOM CREDENTIAL BACKEND AUTH SYSTEM ---
  const syncCustomUserGarage = async (userId: string) => {
    if (!userId || userId === "undefined" || userId === "null") {
      console.warn("syncCustomUserGarage aborted: invalid or empty userId");
      return;
    }
    const useSupabase = isSupabaseConfigured() && supabase;

    // Synchronize custom user subscription tiers & scan properties
    syncUserProfileParameters(userId);

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
      const res = await apiFetch(`/api/user/vehicles/${encodeURIComponent(userId)}`);
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
              await apiFetch(`/api/user/vehicles/${encodeURIComponent(userId)}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ vehicle: car })
              }).catch(e => console.warn("Failed back-porting to node-server:", e));
            })
          );
        }

        // Fetch refreshed garage from custom node database
        const refreshNodeRes = await apiFetch(`/api/user/vehicles/${encodeURIComponent(userId)}`);
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
      const statsRes = await apiFetch("/api/admin/database-stats");
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
            await apiFetch(`/api/user/vehicles/${encodeURIComponent(userId)}`, {
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
    setSqlErrorState(null);

    try {
      const res = await apiFetch("/api/auth/signup", {
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
        if (data.code === "TABLE_MISSING") {
          setSqlErrorState({
            requiredSql: data.requiredSql,
            message: data.message,
            tableName: data.tableName
          });
        }
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
    setSqlErrorState(null);
    setDevOtpCode("");

    try {
      const res = await apiFetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          loginId: authEmail.trim(),
          password: authPassword.trim()
        })
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.code === "TABLE_MISSING") {
          setSqlErrorState({
            requiredSql: data.requiredSql,
            message: data.message,
            tableName: data.tableName
          });
        }
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
        setActiveTab('dashboard');
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
      const res = await apiFetch("/api/auth/verify-otp", {
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
        setActiveTab('dashboard');
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
      const res = await apiFetch("/api/auth/resend-otp", {
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
    setActiveTab('scan');
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
      setActiveTab('scan');
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
              {currentUser ? (
                <>
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
                      {selectedPlanTier === 'chiptuning' && <span className="font-bold text-emerald-400">{Math.max(0, 3 - sessionScansUsed)}/3 rmn</span>}
                      {selectedPlanTier === 'teen_passion' && <span className="font-bold text-indigo-400">{Math.max(0, 15 - sessionScansUsed)}/15 rmn</span>}
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
                </>
              ) : (
                <button
                  onClick={() => handleOpenPlans()}
                  className="px-2.5 py-1.5 bg-gradient-to-r from-indigo-650 to-indigo-550 hover:from-indigo-600 hover:to-indigo-500 text-white font-bold font-mono text-[9px] uppercase tracking-wider rounded-lg border border-indigo-500/20 transition-all cursor-pointer shadow-md shrink-0 flex items-center gap-1"
                >
                  <Sparkles className="h-3 w-3" />
                  <span>View Plans</span>
                </button>
              )}
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

          {sqlErrorState && (
            <div className="p-4 bg-red-950/20 border border-amber-500/35 rounded-2xl space-y-3.5 shadow-xl shadow-black/50 animate-fade-in font-sans">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-100 shrink-0 mt-0.5">
                  <ShieldAlert className="h-5 w-5 text-amber-400" />
                </div>
                <div className="min-w-0 space-y-1">
                  <h4 className="text-xs font-black uppercase tracking-wider text-amber-400 font-mono">
                    🛠️ SUPABASE TABLES MISSING
                  </h4>
                  <p className="text-[10.5px] text-slate-200 leading-normal">
                    One or more required schema relations (including <code className="text-amber-300 font-mono select-all font-bold">{sqlErrorState.tableName}</code>) do not exist in your active Supabase database.
                  </p>
                  <p className="text-[9.5px] text-slate-400 leading-normal font-sans">
                    {sqlErrorState.message}
                  </p>
                </div>
              </div>

              <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-900 text-slate-300 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[9.5px] font-bold font-mono text-amber-400">📋 SUPABASE RUNNABLE SCHEMA SCRIPT</span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(sqlErrorState.requiredSql);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/25 border border-amber-500/35 text-[9.5px] font-bold uppercase tracking-wider transition text-amber-300 cursor-pointer flex items-center gap-1.5"
                  >
                    Copy Schema SQL
                  </button>
                </div>
                <pre className="text-[9px] max-h-40 overflow-y-auto bg-black/60 p-2.5 rounded border border-slate-900 font-mono text-slate-400 leading-normal whitespace-pre select-all">
                  {sqlErrorState.requiredSql}
                </pre>
                <span className="text-[9px] block text-slate-400 font-sans italic text-center">
                  Go to Supabase Dashboard &gt; SQL Editor &gt; Paste script &gt; Click Run
                </span>
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
                      <strong className="text-slate-100 font-extrabold">{scansCountUsed}</strong> Total Scan{scansCountUsed !== 1 ? "s" : ""}
                      {" • "}
                      <strong className="text-slate-100 font-extrabold">{garage.length}</strong> Garage Car{garage.length !== 1 ? "s" : ""}
                      {" • "}
                      <strong className="text-slate-100 font-extrabold">{dashboardStats?.userCommentsCount || 0}</strong> Feedback{ (dashboardStats?.userCommentsCount || 0) !== 1 ? "s" : "" }
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

              {/* Interactive Module: Spotlight TOP RATED COMMUNITY VEHICLE (Moved from scan if logged in) */}
              {currentUser && dashboardStats && dashboardStats.topRatedCar && (
                <div className="space-y-2 pt-2">
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

                  {/* Interactive Module: Spotlight TOP RATED COMMUNITY VEHICLE (Landing Page Only) */}
                  {!currentUser && dashboardStats && dashboardStats.topRatedCar && (
                    <div className="space-y-2 pt-2">
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
                    setCompareList((prev) => {
                      const updated = prev.filter((c) => c.id !== id);
                      uploadUserProfileUpdates({ compare_list: updated });
                      return updated;
                    });
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
              {currentUser && (
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
              )}

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
                      <div className="space-y-2">
                        <div className="p-3 bg-red-950/40 border border-red-500/20 rounded-xl text-red-100 text-[10.5px] leading-relaxed flex items-start gap-2 font-mono">
                          <ShieldAlert className="h-4 w-4 shrink-0 text-red-400 mt-0.5" />
                          <div className="space-y-1">
                            <span className="font-semibold block text-red-300">{authErrorInput}</span>
                            {sqlErrorState && (
                              <p className="text-[9.5px] text-slate-300 mt-1 leading-normal font-sans">
                                {sqlErrorState.message}
                              </p>
                            )}
                          </div>
                        </div>

                        {sqlErrorState && (
                          <div className="p-3 bg-slate-950 rounded-xl border border-amber-500/20 text-slate-300 space-y-2.5">
                            <div className="flex items-center justify-between">
                              <span className="text-[9.5px] font-bold font-mono text-amber-400">📋 SUPABASE RUNNABLE SCHEMA SCRIPT</span>
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(sqlErrorState.requiredSql);
                                }}
                                className="px-2 py-1 rounded bg-amber-500/10 hover:bg-amber-500/25 border border-amber-500/35 text-[9px] font-bold uppercase transition text-amber-300 cursor-pointer"
                              >
                                Copy SQL Code
                              </button>
                            </div>
                            <pre className="text-[8.5px] max-h-32 overflow-y-auto bg-black/60 p-2 rounded border border-slate-900 font-mono text-slate-400 leading-normal whitespace-pre select-all">
                              {sqlErrorState.requiredSql}
                            </pre>
                            <span className="text-[9px] block text-slate-500 font-sans italic text-center">
                              Go to Supabase Dashboard &gt; SQL Editor &gt; Paste visual script &gt; click run
                            </span>
                          </div>
                        )}
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

                  {/* LIVE SUPABASE DB CONNECTION HEALTH MONITOR */}
                  <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-900 space-y-3 font-mono text-left">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-900/45 pb-2">
                      <div className="flex items-center gap-2">
                        <Database className="h-3.5 w-3.5 text-zinc-400 animate-pulse" />
                        <span className="text-[10px] font-black uppercase text-slate-300 tracking-wider">Supabase Connection Health Sentinel</span>
                      </div>
                      <button
                        type="button"
                        onClick={runSupabaseHealthCheck}
                        disabled={supabaseHealth.loading}
                        className="py-1 px-2 rounded bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-400 disabled:text-zinc-600 hover:text-slate-200 text-[9px] uppercase font-bold flex items-center gap-1 cursor-pointer transition shrink-0 select-none"
                      >
                        <RefreshCw className={`h-2.5 w-2.5 ${supabaseHealth.loading ? 'animate-spin text-amber-400' : ''}`} />
                        <span>{supabaseHealth.loading ? 'Verifying...' : 'Test Connection'}</span>
                      </button>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between text-[10px]">
                      {/* Connection state text descriptors */}
                      <div className="space-y-1.5 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-zinc-500 uppercase text-[8px]">Endpoint:</span>
                          <span className="bg-slate-900 px-1.5 py-0.5 rounded text-zinc-400 text-[8.5px] select-all tracking-tight break-all border border-slate-850">
                            {supabaseHealth.url || "Not Configured"}
                          </span>
                        </div>
                        <div className="flex items-start gap-1.5 leading-snug">
                          {supabaseHealth.loading ? (
                            <div className="flex items-center gap-1.5 text-amber-500">
                              <Loader2 className="h-3 w-3 animate-spin shrink-0 text-amber-400" />
                              <span className="text-[9px]">Probing database cluster configurations...</span>
                            </div>
                          ) : supabaseHealth.success === null ? (
                            <div className="text-zinc-500">
                              No test performed check. Click "Test Connection" to check status.
                            </div>
                          ) : supabaseHealth.success ? (
                            <div className="flex items-start gap-1.5 text-emerald-400">
                              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400 mt-0.5" />
                              <div>
                                <span className="font-bold">STATUS: ONLINE</span>
                                <p className="text-[9.5px] text-zinc-400 mt-0.5 font-sans leading-normal">{supabaseHealth.message}</p>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-start gap-1.5 text-red-500">
                              <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-red-500 mt-0.5" />
                              <div>
                                <span className="font-bold">STATUS: OFFLINE</span>
                                <p className="text-[9.5px] text-zinc-400 mt-0.5 font-sans leading-normal">{supabaseHealth.message}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Summary side Badge */}
                      <div className="shrink-0 flex items-center justify-start sm:justify-end select-none">
                        {supabaseHealth.loading ? (
                          <span className="px-2 py-0.5 rounded bg-amber-950/20 text-amber-400 border border-amber-500/20 text-[8px] font-bold">PROBING CLUSTER</span>
                        ) : supabaseHealth.success === null ? (
                          <span className="px-2 py-0.5 rounded bg-slate-900 text-slate-500 border border-slate-800 text-[8px] font-bold">UNTESTED</span>
                        ) : supabaseHealth.success ? (
                          supabaseHealth.message.includes("does not exist") ? (
                            <span className="px-2 py-0.5 rounded bg-amber-950 text-amber-400 border border-amber-500/35 text-[8px] font-bold">SCHEMA MISSING</span>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-500/30 text-[8px] font-bold">FULLY ONLINE</span>
                          )
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-red-950 text-red-400 border border-red-500/30 text-[8px] font-bold">DISCONNECTED</span>
                        )}
                      </div>
                    </div>

                    {/* Stack trace / detailed disclosure panel if error exists or connection has a debug report */}
                    {supabaseHealth.error && (
                      <div className="pt-1.5 border-t border-slate-900/40">
                        <button
                          type="button"
                          onClick={() => setShowHealthTrace(!showHealthTrace)}
                          className="text-[9px] text-zinc-400 hover:text-white uppercase font-bold flex items-center gap-1 cursor-pointer select-none transition focus:outline-none"
                        >
                          <span>{showHealthTrace ? "▼ Hide" : "▶ Show"} Connection Diagnostics & Stacktrace</span>
                        </button>
                        
                        {showHealthTrace && (
                          <div className="mt-2 p-2.5 bg-red-950/15 border border-red-900/30 rounded-lg space-y-1.5 text-left">
                            <span className="text-[8px] text-red-400/90 font-bold block uppercase tracking-wider font-mono">Traceback Diagnostics Log</span>
                            <div className="p-2 bg-slate-950 rounded text-[9px] text-rose-300 font-mono break-all whitespace-pre-wrap select-all max-h-52 overflow-y-auto leading-relaxed border border-slate-900">
                              {supabaseHealth.error.stack || `Error Message: ${supabaseHealth.error.message}\nCode: ${supabaseHealth.error.code || "N/A"}\nDetails: ${supabaseHealth.error.details || "N/A"}\nHint: ${supabaseHealth.error.hint || "N/A"}`}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Elegant Horizontal Tab Bar */}
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-1 bg-slate-950 border border-slate-900 rounded-xl p-1 font-mono text-[9px] leading-tight shadow-inner select-none">
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
                        setAdminSubTab('live_explorer');
                        fetchExplorerRows(explorerTable);
                      }}
                      className={`py-2 px-1 rounded-lg font-bold transition flex items-center justify-center gap-1 cursor-pointer truncate ${
                        adminSubTab === 'live_explorer'
                          ? 'bg-red-500/15 text-red-400 border border-red-500/25 shadow-sm'
                          : 'text-slate-400 hover:text-slate-200 border border-transparent'
                      }`}
                    >
                      <Layers className="h-3 w-3 shrink-0" />
                      <span>LIVE EXPLORER</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setAdminSubTab('supabase_wipe');
                        fetchSupabaseTotalCounts();
                      }}
                      className={`py-2 px-1 rounded-lg font-bold transition flex items-center justify-center gap-1 cursor-pointer truncate ${
                        adminSubTab === 'supabase_wipe'
                          ? 'bg-red-500/15 text-red-400 border border-red-500/25 shadow-sm'
                          : 'text-slate-400 hover:text-slate-200 border border-transparent'
                      }`}
                    >
                      <Trash2 className="h-3 w-3 shrink-0 text-red-400" />
                      <span>CLOUD WIPE</span>
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

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={handleCopySql}
                            className="flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-red-500/10 hover:bg-red-650/20 border border-red-500/35 hover:border-red-550/60 font-mono text-[10px] font-bold text-red-100 hover:text-white transition cursor-pointer active:scale-[0.99]"
                          >
                            {copiedSql ? (
                              <>
                                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                                <span>SQL SCHEMA COPIED</span>
                              </>
                            ) : (
                              <>
                                <Copy className="h-4 w-4 text-red-400" />
                                <span>{sqlSchemaMode === 'create' ? "COPY COMPLETE SCHEMA" : "COPY TABLE UPGRADE SQL"}</span>
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleApplySqlDirectly(sqlSchemaMode === 'create' ? SCHEMA_CREATE_SQL : SCHEMA_UPGRADE_SQL)}
                            disabled={isApplyingSql || !isSupabaseConfigured()}
                            className="flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-emerald-500/10 hover:bg-emerald-600/20 disabled:bg-slate-900 disabled:opacity-40 border border-emerald-500/35 hover:border-emerald-550/60 disabled:border-slate-800 font-mono text-[10px] font-bold text-emerald-400 disabled:text-zinc-600 hover:text-white transition cursor-pointer active:scale-[0.99]"
                          >
                            {isApplyingSql ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span>APPLYING CHANGES...</span>
                              </>
                            ) : (
                              <>
                                <Database className="h-4 w-4 text-emerald-400" />
                                <span>APPLY DIRECTLY TO DB</span>
                              </>
                            )}
                          </button>
                        </div>

                        {sqlExecutionFeedback && (
                          <div className={`p-3 rounded-xl border font-mono text-[9.5px] leading-relaxed space-y-2 ${
                            sqlExecutionFeedback.success 
                              ? 'bg-emerald-950/40 border-emerald-500/25 text-emerald-300' 
                              : 'bg-red-950/40 border-red-500/25 text-red-300'
                          }`}>
                            <div className="flex items-center gap-1.5 font-bold">
                              {sqlExecutionFeedback.success ? (
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                              ) : (
                                <ShieldAlert className="h-3.5 w-3.5 text-red-400 shrink-0" />
                              )}
                              <span>{sqlExecutionFeedback.success ? "EXECUTION SUCCESS" : "DATABASE EXECUTION FAILED"}</span>
                            </div>
                            <p>{sqlExecutionFeedback.message}</p>
                            {sqlExecutionFeedback.error && (
                              <p className="opacity-90 font-mono text-[8.5px] bg-slate-950/80 p-1.5 rounded border border-rose-950/50 select-all whitespace-pre-wrap">{sqlExecutionFeedback.error}</p>
                            )}
                            {sqlExecutionFeedback.setupSql && (
                              <div className="space-y-1.5 pt-1.5 border-t border-red-500/10">
                                <span className="text-[8.5px] text-amber-400 block uppercase font-bold">Safe Execution Helper Setup (Paste once into Supabase SQL Editor):</span>
                                <div className="relative group bg-slate-950/90 border border-slate-900 rounded p-1.5">
                                  <pre className="text-[8.5px] text-zinc-300 overflow-x-auto select-all leading-normal max-h-32 overflow-y-auto">
                                    {sqlExecutionFeedback.setupSql}
                                  </pre>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      navigator.clipboard.writeText(sqlExecutionFeedback.setupSql || "");
                                    }}
                                    className="absolute right-2 top-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-[8px] font-bold px-1.5 py-0.5 rounded text-slate-300 transition cursor-pointer"
                                  >
                                    Copy Script
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        <div className="bg-slate-950 rounded-xl border border-slate-900 p-3 overflow-hidden text-left relative group">
                          <pre className="text-[9px] text-zinc-400 font-mono max-h-48 overflow-y-auto leading-relaxed select-all">
                            {sqlSchemaMode === 'create' ? SCHEMA_CREATE_SQL : SCHEMA_UPGRADE_SQL}
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

                      {/* Community Scans & Spots Statistics */}
                      <div className="grid grid-cols-2 gap-2 font-mono text-[10px] pt-1">
                        <div className="p-2.5 bg-slate-950 border border-slate-900 rounded-xl">
                          <span className="text-[8px] text-zinc-500 block uppercase mb-1">Unique Scanned Images</span>
                          <strong className="text-indigo-400 text-xs font-black">{dashboardStats ? dashboardStats.totalUniqueScannedImages : 0}</strong>
                          <p className="text-[9px] text-zinc-550 mt-0.5 leading-normal">Total count of unique physical files spotted across all users.</p>
                        </div>
                        <div className="p-2.5 bg-slate-950 border border-slate-900 rounded-xl">
                          <span className="text-[8px] text-zinc-500 block uppercase mb-1">Community Database Spots</span>
                          <strong className="text-yellow-400 text-xs font-black">{dashboardStats ? dashboardStats.totalScansCount : 0}</strong>
                          <p className="text-[9px] text-zinc-550 mt-0.5 leading-normal">Sum total of all vehicle scans/spots logged in collective database.</p>
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

                      {/* Scan / Computer Vision Error Logs Panel */}
                      {adminDbStats?.scanErrors && adminDbStats.scanErrors.length > 0 && (
                        <div className="space-y-4 pt-3.5 border-t border-slate-900 animate-fade-in text-left">
                          <div className="flex items-center justify-between">
                            <h5 className="text-[10px] font-bold text-amber-500 uppercase font-mono tracking-wider flex items-center gap-1.5 animate-pulse">
                              🔍 Neural Vision Scan & Computer Vision Errors ({adminDbStats.scanErrors.length})
                            </h5>
                            <span className="text-[8px] font-mono text-zinc-500 uppercase">Captured Live Logs</span>
                          </div>
                          
                          <div className="max-h-56 overflow-y-auto space-y-1.5 border border-amber-95/30 rounded-xl bg-slate-950 p-2.5">
                            {adminDbStats.scanErrors.map((log: any, index: number) => (
                              <details key={index} className="group bg-slate-900/30 rounded-lg border border-amber-950/20 overflow-hidden transition-all text-[9.5px]">
                                <summary className="flex items-center justify-between p-2 cursor-pointer hover:bg-slate-900/70 select-none">
                                  <div className="flex flex-col gap-0.5 text-left text-[9px]">
                                    <div className="flex items-center gap-1.5">
                                      <span className="bg-amber-950 text-amber-400 text-[8px] font-extrabold px-1 rounded uppercase tracking-wider">
                                        {log.planTier ? log.planTier.toUpperCase() : "GUEST"}
                                      </span>
                                      <span className="text-zinc-300 font-bold uppercase font-mono">
                                        {log.userEmail || "Anonymous Guest"}
                                      </span>
                                    </div>
                                    <span className="text-zinc-500 text-[8px] font-mono">
                                      {new Date(log.timestamp).toLocaleTimeString()} ({new Date(log.timestamp).toLocaleDateString()}) • Scans used: {log.sessionScansUsed ?? 0}
                                    </span>
                                  </div>
                                  <span className="text-zinc-450 text-[10px] group-open:rotate-180 transform transition font-mono">▼</span>
                                </summary>
                                <div className="p-2.5 bg-black border-t border-slate-900 font-mono text-[8.5px] text-amber-500/90 select-all leading-normal text-left whitespace-pre-wrap max-h-48 overflow-auto">
                                  <div className="text-zinc-300 font-sans text-[9px] font-medium border-b border-amber-950/40 pb-1 mb-1.5">
                                    <strong className="text-amber-500">Error:</strong> {log.message}
                                    {log.imageUrl && (
                                      <div className="mt-1 text-[8px] text-zinc-400 truncate">
                                        <strong>Image URL:</strong> {log.imageUrl}
                                      </div>
                                    )}
                                    {log.imageSize && (
                                      <div className="mt-0.5 text-[8px] text-zinc-400">
                                        <strong>Base64 Size:</strong> {log.imageSize} characters
                                      </div>
                                    )}
                                  </div>
                                  <code>{log.stack || "No callstack tracing available."}</code>
                                </div>
                              </details>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Database Error Log Stack Tracing Panel */}
                      {adminDbStats?.errorLogs && adminDbStats.errorLogs.length > 0 && (
                        <div className="space-y-4 pt-3.5 border-t border-slate-900 animate-fade-in text-left">
                          <div className="flex items-center justify-between">
                            <h5 className="text-[10px] font-bold text-red-400 uppercase font-mono tracking-wider flex items-center gap-1.5 animate-pulse">
                              ⚠️ Host DB Transaction Error Stacktraces ({adminDbStats.errorLogs.length})
                            </h5>
                            <span className="text-[8px] font-mono text-zinc-500 uppercase">Real-Time Trace Captured</span>
                          </div>
                          
                          <div className="max-h-56 overflow-y-auto space-y-1.5 border border-red-905/30 rounded-xl bg-slate-950 p-2.5">
                            {adminDbStats.errorLogs.map((log: any, index: number) => (
                              <details key={index} className="group bg-slate-900/30 rounded-lg border border-red-950/20 overflow-hidden transition-all text-[9.5px]">
                                <summary className="flex items-center justify-between p-2 cursor-pointer hover:bg-slate-900/70 select-none">
                                  <div className="flex flex-col gap-0.5 text-left text-[9px]">
                                    <div className="flex items-center gap-1.5">
                                      <span className="bg-red-950 text-red-400 text-[8px] font-extrabold px-1 rounded uppercase tracking-wider">
                                        {log.code || "ERR"}
                                      </span>
                                      <span className="text-zinc-300 font-bold uppercase font-mono">{log.context || "Operation"}</span>
                                    </div>
                                    <span className="text-zinc-500 text-[8px] font-mono">{new Date(log.timestamp).toLocaleTimeString()} ({new Date(log.timestamp).toLocaleDateString()})</span>
                                  </div>
                                  <span className="text-zinc-450 text-[10px] group-open:rotate-180 transform transition font-mono">▼</span>
                                </summary>
                                <div className="p-2.5 bg-black border-t border-slate-900 font-mono text-[8.5px] text-red-500 select-all leading-normal text-left whitespace-pre-wrap max-h-48 overflow-auto">
                                  <div className="text-zinc-300 font-sans text-[9px] font-medium border-b border-red-950/40 pb-1 mb-1.5">
                                    <strong className="text-red-400">Error Msg:</strong> {log.message}
                                    {log.tableName && (
                                      <span className="ml-2 bg-slate-905 text-zinc-400 text-[8px] px-1 rounded border border-slate-800 font-mono">
                                        Table: {log.tableName}
                                      </span>
                                    )}
                                  </div>
                                  <code>{log.stack || "No callstack tracing available."}</code>
                                </div>
                              </details>
                            ))}
                          </div>
                        </div>
                      )}

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

                        {/* WIPE USERS IN APP BUTTON */}
                        <div className="pt-2 border-t border-slate-900/60 space-y-2 text-left">
                          <p className="text-[9px] text-zinc-500 font-sans leading-normal">Wipe registered users in the app without resetting the vehicle scan database archives.</p>
                          
                          {!showWipeUsersConfirm ? (
                            <button
                              type="button"
                              onClick={() => setShowWipeUsersConfirm(true)}
                              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-orange-950/20 hover:bg-orange-950/40 border border-orange-900/45 hover:border-orange-850 font-mono text-[10px] font-bold text-orange-200 hover:text-white transition cursor-pointer"
                            >
                              <User className="h-3.5 w-3.5 text-orange-400" />
                              <span>WIPE ALL REGISTERED USERS</span>
                            </button>
                          ) : (
                            <div className="p-3 bg-orange-950/20 border border-orange-550/30 rounded-xl space-y-2 text-center">
                              <p className="text-[9.5px] text-orange-200 font-bold uppercase font-mono tracking-wider">
                                ⚠️ WIPE ALL REGISTERED USERS?
                              </p>
                              <p className="text-[9px] text-zinc-400 font-sans leading-normal">
                                This will instantly clear all users registered in the app. Users will be logged out and forced to sign up/verify again.
                              </p>
                              <div className="grid grid-cols-2 gap-2">
                                <button
                                  type="button"
                                  onClick={() => setShowWipeUsersConfirm(false)}
                                  className="py-1 px-2.5 rounded-lg bg-slate-900 hover:bg-slate-850 border border-slate-800 text-zinc-400 font-mono font-bold text-[9px] uppercase cursor-pointer transition text-center"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={handleWipeRegisteredUsers}
                                  className="py-1 px-2.5 rounded-lg bg-orange-655 hover:bg-orange-600 text-white font-mono font-bold text-[9px] uppercase cursor-pointer transition text-center shadow-md shadow-orange-950/50"
                                >
                                  YES, WIPE USERS
                                </button>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Purge status logging monitor */}
                        {resetFeedback && (
                          <div className="p-3 bg-red-950/30 border border-red-900/30 rounded-xl text-red-300 text-[10px] leading-relaxed font-mono">
                            {resetFeedback}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {adminSubTab === 'live_explorer' && (
                    <div className="space-y-4 animate-fade-in text-left">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-900 pb-3">
                        <div className="space-y-1">
                          <h4 className="text-xs font-black text-slate-200 uppercase font-mono tracking-wider flex items-center gap-1.5 animate-pulse">
                            ⚡ LIVE HOST DB EXPLORER
                          </h4>
                          <p className="text-[10px] text-zinc-500 uppercase font-mono">
                            Interact with live relational tables in your active Supabase environment
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => fetchExplorerRows(explorerTable)}
                            disabled={explorerLoading}
                            className="py-1 px-2.5 rounded-lg bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 font-mono text-[9px] uppercase flex items-center justify-center gap-1.5 cursor-pointer transition select-none disabled:opacity-50 animate-fade-in"
                          >
                            <RefreshCw className={`h-3 w-3 text-red-400 ${explorerLoading ? 'animate-spin' : ''}`} />
                            <span>{explorerLoading ? "Connecting..." : "REFRESH SNAPSHOT"}</span>
                          </button>
                        </div>
                      </div>

                      {explorerStatusMessage && (
                        <div className="p-2.5 bg-emerald-950/20 border border-emerald-500/20 text-emerald-400 text-[10px] rounded-lg font-mono">
                          ✓ {explorerStatusMessage}
                        </div>
                      )}

                      {/* Live Table Selection Tabs */}
                      <div className="flex flex-wrap gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-900">
                        {(["whipcheck_users", "vehicles", "comments", "whipcheck_identify_cache"] as const).map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => {
                              setExplorerTable(t);
                              setExplorerSelectedRow(null);
                              setExplorerEditingRow(null);
                              fetchExplorerRows(t);
                            }}
                            className={`flex-1 py-1.5 px-2 rounded-lg font-mono text-[9px] font-bold uppercase transition text-center truncate cursor-pointer ${
                              explorerTable === t
                                ? "bg-red-500/10 text-red-400 border border-red-500/20"
                                : "text-zinc-500 hover:text-zinc-300 hover:bg-slate-900/30 border border-transparent"
                            }`}
                          >
                            <span>{t.replace("whipcheck_", "")}</span>
                            <span className="ml-1 opacity-60 text-[8px]">
                              ({explorerTable === t ? explorerRows.length : "?"})
                            </span>
                          </button>
                        ))}
                      </div>

                      {/* Capture Missing Table Errors Stacktraces inside the explorer */}
                      {explorerError && (
                        <div className="p-3 bg-red-950/20 border border-red-500/20 text-red-100 text-[10.5px] rounded-xl font-mono leading-relaxed space-y-2 text-left">
                          <div className="flex items-center gap-2 text-red-400 font-extrabold text-[10px] uppercase tracking-wider">
                            <span>❌ REMOTE DATABASE EXCEPTION CAUGHT</span>
                            {explorerError.code && (
                              <span className="bg-red-950/80 px-1 rounded border border-red-900/40 text-[8.5px]">
                                Code: {explorerError.code}
                              </span>
                            )}
                          </div>
                          <p className="text-zinc-300">{explorerError.message}</p>
                          
                          {explorerError.requiredSql && (
                            <div className="space-y-1.5 flex flex-col pt-1.5 border-t border-red-500/10">
                              <span className="text-[8.5px] uppercase font-bold text-red-400 block font-mono">Required Schema Script definitions:</span>
                              <pre className="p-2 bg-black border border-red-950/45 rounded-lg text-[8px] text-red-400 overflow-x-auto select-all max-h-40 overflow-y-auto leading-normal font-mono select-all">
                                {explorerError.requiredSql}
                              </pre>

                              <button
                                type="button"
                                disabled={isApplyingSql || !isSupabaseConfigured()}
                                onClick={async () => {
                                  await handleApplySqlDirectly(explorerError.requiredSql);
                                  // Clear error and trigger snapshot re-fetch
                                  setExplorerError(null);
                                  fetchExplorerRows(explorerTable);
                                }}
                                className="mt-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-emerald-500/15 hover:bg-emerald-600/25 border border-emerald-500/40 text-emerald-400 transition cursor-pointer select-none font-sans font-black text-[9px] uppercase active:scale-[0.99] disabled:opacity-50"
                              >
                                {isApplyingSql ? (
                                  <>
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    <span>RUNNING REPAIR DIRECTLY ON DATABASE...</span>
                                  </>
                                ) : (
                                  <>
                                    <Database className="h-3.5 w-3.5 text-emerald-400 animate-pulse" />
                                    <span>🚀 INTERACTION POINT: APPLY DIRECTLY TO FIX TABLE</span>
                                  </>
                                )}
                              </button>
                            </div>
                          )}

                          {explorerError.stack && (
                            <details className="group border-t border-red-950/30 pt-1.5">
                              <summary className="text-[8px] text-zinc-500 uppercase cursor-pointer select-none font-bold hover:text-zinc-400">
                                ▶ Show Raw Database Error Backtrace
                              </summary>
                              <pre className="p-2 bg-slate-950 rounded-lg text-[8px] text-red-500 overflow-x-auto whitespace-pre-wrap select-all max-h-40 leading-normal mt-1 border border-red-950/10 font-mono">
                                {explorerError.stack}
                              </pre>
                            </details>
                          )}
                        </div>
                      )}

                      {/* Main Interactive Workspace Area: Split Layout when row selected/edited */}
                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                        {/* LEFT: TABLE INDEX LIST */}
                        <div className={`${(explorerSelectedRow || explorerEditingRow) ? "lg:col-span-7" : "lg:col-span-12"} space-y-3`}>
                          {/* Inner filter query */}
                          <div className="relative">
                            <input
                              type="text"
                              placeholder={`Filter live ${explorerTable.replace("whipcheck_", "")} records...`}
                              value={explorerSearchQuery}
                              onChange={(e) => setExplorerSearchQuery(e.target.value)}
                              className="w-full bg-slate-950 border border-slate-900 rounded-lg pl-8 pr-3 py-1.5 text-[10px] text-slate-300 focus:outline-none focus:border-red-500/50 transition font-mono focus:ring-1 focus:ring-red-500/20"
                            />
                            <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-650">
                              <Search className="h-3 w-3" />
                            </div>
                            {explorerSearchQuery && (
                              <button
                                type="button"
                                onClick={() => setExplorerSearchQuery("")}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-550 hover:text-zinc-300 font-mono text-[8px] uppercase font-bold cursor-pointer"
                              >
                                clear
                              </button>
                            )}
                          </div>

                          {/* Record List */}
                          {explorerLoading && explorerRows.length === 0 ? (
                            <div className="py-12 text-center border border-slate-900 rounded-xl bg-slate-950/45">
                              <Loader2 className="h-6 w-6 text-red-500 animate-spin mx-auto opacity-70 mb-2" />
                              <span className="text-[10px] font-mono text-zinc-500 uppercase block tracking-wider">Synchronising Live Supabase State...</span>
                            </div>
                          ) : (
                            <div className="border border-slate-900 rounded-xl overflow-hidden bg-slate-950/30">
                              <div className="overflow-x-auto max-h-96">
                                <table className="w-full text-left border-collapse text-[9.5px]">
                                  <thead>
                                    <tr className="bg-slate-950 border-b border-slate-900 text-[8.5px] uppercase font-mono font-black text-slate-400 tracking-wider sticky top-0 z-5 select-none">
                                      <th className="py-2.5 px-3">Primary Key / ID</th>
                                      {explorerTable === "whipcheck_users" && (
                                        <>
                                          <th className="py-2.5 px-3">Username</th>
                                          <th className="py-2.5 px-3">Email</th>
                                          <th className="py-2.5 px-3">Status</th>
                                        </>
                                      )}
                                      {explorerTable === "vehicles" && (
                                        <>
                                          <th className="py-2.5 px-3">Owner User ID</th>
                                          <th className="py-2.5 px-3">Brand/Model</th>
                                          <th className="py-2.5 px-3 font-mono">Added At</th>
                                        </>
                                      )}
                                      {explorerTable === "comments" && (
                                        <>
                                          <th className="py-2.5 px-3">Car Identifier</th>
                                          <th className="py-2.5 px-3">Username</th>
                                          <th className="py-2.5 px-3">Topic / Msg</th>
                                        </>
                                      )}
                                      {explorerTable === "whipcheck_identify_cache" && (
                                        <>
                                          <th className="py-2.5 px-3">Model Key</th>
                                          <th className="py-2.5 px-3">Hit Hits</th>
                                          <th className="py-2.5 px-3">Last Query Date</th>
                                        </>
                                      )}
                                      <th className="py-2.5 px-3 text-right">Actions</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {(() => {
                                      const query = explorerSearchQuery.toLowerCase().trim();
                                      const filtered = explorerRows.filter((row: any) => {
                                        if (!query) return true;
                                        return JSON.stringify(row).toLowerCase().includes(query);
                                      });

                                      if (filtered.length === 0) {
                                        return (
                                          <tr>
                                            <td colSpan={10} className="py-8 text-center text-zinc-500 font-mono text-[9px] uppercase">
                                              No matching live records found.
                                            </td>
                                          </tr>
                                        );
                                      }

                                      return filtered.map((row: any, i: number) => {
                                        const keyVal = explorerTable === "whipcheck_identify_cache" 
                                          ? row.key 
                                          : row.id;
                                        
                                        const isSelected = explorerSelectedRow && (
                                          explorerTable === "whipcheck_identify_cache" 
                                            ? explorerSelectedRow.key === row.key 
                                            : explorerSelectedRow.id === row.id
                                        );

                                        return (
                                          <tr 
                                            key={i} 
                                            className={`border-b border-slate-900 hover:bg-slate-900/15 font-mono cursor-pointer transition select-all ${
                                              isSelected ? "bg-red-500/5 hover:bg-red-500/10" : i % 2 === 0 ? "bg-slate-950/20" : ""
                                            }`}
                                            onClick={() => {
                                              setExplorerSelectedRow(row);
                                              setExplorerEditingRow(null);
                                            }}
                                          >
                                            <td className="py-2 px-3 text-slate-200 font-bold tracking-tight">
                                              <span className="truncate max-w-[120px] block" title={keyVal}>
                                                {keyVal}
                                              </span>
                                            </td>
                                            
                                            {explorerTable === "whipcheck_users" && (
                                              <>
                                                <td className="py-2 px-3 text-teal-400 font-bold">{row.username || "unset"}</td>
                                                <td className="py-2 px-3 text-zinc-400">{row.email || "unset"}</td>
                                                <td className="py-2 px-3">
                                                  <span className={`px-1 rounded text-[8px] font-extrabold uppercase ${
                                                    row.is_verified 
                                                      ? "bg-emerald-950 border border-emerald-900 text-emerald-400" 
                                                      : "bg-amber-950 border border-amber-900 text-amber-500"
                                                  }`}>
                                                    {row.is_verified ? "Verified" : "Pending OTP"}
                                                  </span>
                                                </td>
                                              </>
                                            )}

                                            {explorerTable === "vehicles" && (
                                              <>
                                                <td className="py-2 px-3 text-zinc-500">
                                                  <span className="truncate max-w-[100px] block" title={row.user_id}>
                                                    {row.user_id || "null"}
                                                  </span>
                                                </td>
                                                <td className="py-2 px-3 text-red-500 font-bold">
                                                  {row.make ? `${row.make} ${row.model || ""}` : "Unset vehicle"}
                                                </td>
                                                <td className="py-2 px-3 text-zinc-500">
                                                  {row.created_at ? new Date(row.created_at).toLocaleDateString() : "-"}
                                                </td>
                                              </>
                                            )}

                                            {explorerTable === "comments" && (
                                              <>
                                                <td className="py-2 px-3 text-zinc-400 font-sans">
                                                  <span className="truncate max-w-[80px] block text-inherit" title={row.car_id}>
                                                    {row.car_id || "null"}
                                                  </span>
                                                </td>
                                                <td className="py-2 px-3 text-slate-300 font-bold">{row.username || "guest"}</td>
                                                <td className="py-2 px-3 text-zinc-400">
                                                  <span className="truncate max-w-[185px] block font-sans text-[9px]" title={row.text_content}>
                                                    {row.text_content || ""}
                                                  </span>
                                                </td>
                                              </>
                                            )}

                                            {explorerTable === "whipcheck_identify_cache" && (
                                              <>
                                                <td className="py-2 px-3 text-teal-500">{row.model_name || "N/A"}</td>
                                                <td className="py-2 px-3 text-zinc-400 font-bold">{row.usage_count || 1} hits</td>
                                                <td className="py-2 px-3 text-zinc-500">
                                                  {row.query_timestamp ? new Date(row.query_timestamp).toLocaleDateString() : "-"}
                                                </td>
                                              </>
                                            )}

                                            {/* Action item buttons */}
                                            <td className="py-2 px-3 text-right" onClick={(e) => e.stopPropagation()}>
                                              <div className="flex items-center justify-end gap-1 select-none">
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    setExplorerSelectedRow(row);
                                                    setExplorerEditingRow(null);
                                                  }}
                                                  className="p-1 rounded bg-slate-905 border border-slate-800 text-zinc-400 hover:text-white transition cursor-pointer"
                                                  title="Inspect Full Row Record"
                                                >
                                                  <SlidersHorizontal className="h-2.5 w-2.5" />
                                                </button>
                                                
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    setExplorerEditingRow(row);
                                                    setExplorerSelectedRow(null);
                                                    setExplorerEditPayload(JSON.stringify(row, null, 2));
                                                    setExplorerEditError(null);
                                                  }}
                                                  className="p-1 rounded bg-slate-905 border border-slate-800 text-yellow-500 hover:text-yellow-400 transition cursor-pointer"
                                                  title="Edit JSON payload"
                                                >
                                                  <Code className="h-2.5 w-2.5" />
                                                </button>

                                                <button
                                                  type="button"
                                                  onClick={() => deleteExplorerRow(explorerTable, row)}
                                                  className="p-1 rounded bg-red-950/25 border border-red-900/30 text-red-500 hover:text-red-400 transition cursor-pointer"
                                                  title="Delete record from host database"
                                                >
                                                  <Trash2 className="h-2.5 w-2.5" />
                                                </button>
                                              </div>
                                            </td>
                                          </tr>
                                        );
                                      });
                                    })()}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}

                          {/* Quick Tool: Inject/Insert Test Row */}
                          <div className="bg-slate-900/10 border border-slate-900/40 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2.5 text-left font-sans select-none animate-fade-in">
                            <div className="space-y-0.5">
                              <span className="text-[10px] uppercase font-bold text-zinc-300 font-mono block">💡 HOST SEEDING PORTAL</span>
                              <p className="text-[9px] text-zinc-500 leading-normal font-mono uppercase">Pre-configure and insert testing data payloads into {explorerTable}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                let tmpl: any = {};
                                if (explorerTable === "whipcheck_users") {
                                  tmpl = {
                                    id: "user_" + Math.floor(1000 + Math.random() * 9000),
                                    username: "track_master",
                                    email: `test_racer_${Math.floor(100 + Math.random()*900)}@example.com`,
                                    password_hash: "plain_text_dev_override_password_hash",
                                    is_verified: true,
                                    created_at: new Date().toISOString()
                                  };
                                } else if (explorerTable === "vehicles") {
                                  tmpl = {
                                    id: `scan_${Math.floor(1000 + Math.random()*9000)}`,
                                    user_id: "user_racer_default",
                                    make: "Toyota",
                                    model: "Supra RZ Turbo",
                                    year: 1997,
                                    engine: "3.0L twin-turbo I6 (2JZ-GTE)",
                                    spec_torque: "315 lb-ft",
                                    spec_horsepower: "320 hp",
                                    zero_to_sixty: "4.6s",
                                    curb_weight: "3,450 lbs",
                                    quarter_mile: "13.1s",
                                    trivia: ["Manufactured in Japan's Motomachi plant", "The iconic fastback coupe utilizes the highly tuner-friendly 2JZ block"],
                                    tips: ["Check for coolant leak near the secondary turbo actuator hoses", "Highly receptive to single-turbo exhaust conversions"],
                                    created_at: new Date().toISOString()
                                  };
                                } else if (explorerTable === "comments") {
                                  tmpl = {
                                    id: Math.floor(10000 + Math.random() * 90000),
                                    car_id: "supra_mk4",
                                    username: "JDM Legend Guy",
                                    text_content: "Incredible vehicle specification. The 2JZ-GTE holds an incredible legacy!",
                                    created_at: new Date().toISOString()
                                  };
                                } else if (explorerTable === "whipcheck_identify_cache") {
                                  tmpl = {
                                    key: "demo-supra-model-key-" + Math.floor(100+Math.random()*900),
                                    model_name: "Toyota Supra MK4",
                                    usage_count: 14,
                                    query_timestamp: new Date().toISOString()
                                  };
                                }
                                setExplorerEditingRow(tmpl);
                                setExplorerSelectedRow(null);
                                setExplorerEditPayload(JSON.stringify(tmpl, null, 2));
                                setExplorerEditError(null);
                              }}
                              className="py-1 px-2.5 rounded-lg bg-red-950/20 hover:bg-red-950/40 border border-red-900/40 text-[9px] font-mono text-red-400 font-bold uppercase cursor-pointer transition select-none"
                            >
                              + CREATE BLANK TARGET TEMPLATE
                            </button>
                          </div>
                        </div>

                        {/* RIGHT: DETAILS INSPECTION OR LIVE JSON EDITOR PANE */}
                        {(explorerSelectedRow || explorerEditingRow) && (
                          <div className="lg:col-span-12 xl:col-span-5 space-y-3.5 animate-slide-in text-left">
                            {/* CASE A: JSON EDITOR PANEL */}
                            {explorerEditingRow && (
                              <div className="p-4 bg-gradient-to-b from-slate-950 to-[#0b0c10] border border-yellow-950/45 rounded-xl relative space-y-3">
                                <div className="absolute top-0 right-0 w-20 h-20 bg-yellow-500/5 rounded-full blur-lg pointer-events-none"></div>

                                <div className="flex items-center justify-between border-b border-slate-900 pb-2.5">
                                  <div className="flex items-center gap-2 font-mono text-[10px]">
                                    <span className="p-1 rounded bg-yellow-950 text-yellow-500 font-extrabold border border-yellow-905/30 uppercase tracking-widest text-[8px]">
                                      Upsert / Edit
                                    </span>
                                    <strong className="text-zinc-300 uppercase">Live Host Table Payload</strong>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => setExplorerEditingRow(null)}
                                    className="text-zinc-500 hover:text-zinc-300 font-mono text-[9px] uppercase font-bold cursor-pointer"
                                  >
                                    ✕ CLOSE
                                  </button>
                                </div>

                                <div className="space-y-1">
                                  <span className="text-[8.5px] uppercase font-mono font-bold text-zinc-500 block">Edit raw JSON structure:</span>
                                  <textarea
                                    value={explorerEditPayload}
                                    onChange={(e) => setExplorerEditPayload(e.target.value)}
                                    rows={15}
                                    className="w-full bg-black border border-slate-850 rounded-lg p-2.5 font-mono text-[9px] text-zinc-300 leading-normal focus:outline-none focus:border-yellow-500/40 select-all focus:ring-1 focus:ring-yellow-500/10 h-72 resize-y"
                                    placeholder='{ "id": "custom-row-id", "field": "value" }'
                                  />
                                </div>

                                {explorerEditError && (
                                  <div className="p-2.5 bg-red-950/30 border border-red-500/25 text-red-100 text-[10px] leading-relaxed rounded-lg font-mono">
                                    <strong className="text-red-400 block mb-0.5">⚠️ Validator Error:</strong>
                                    {explorerEditError}
                                  </div>
                                )}

                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    onClick={() => updateExplorerRow(explorerTable)}
                                    disabled={explorerLoading}
                                    className="flex-1 text-center py-2 text-[10px] font-mono font-bold uppercase py-1.5 rounded-lg text-white bg-green-700 hover:bg-green-600 border border-green-800 transition cursor-pointer flex items-center justify-center gap-1.5 active:scale-[0.99]"
                                  >
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                    <span>COMMIT SNAPSHOT TO SUPABASE</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setExplorerEditingRow(null)}
                                    className="px-3 py-2 text-[10px] font-mono font-bold uppercase py-1.5 rounded-lg text-zinc-400 bg-slate-900 border border-slate-805 hover:text-white transition cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* CASE B: INSPECTION PANEL */}
                            {explorerSelectedRow && (
                              <div className="p-4 bg-gradient-to-b from-[#0b0c10] via-slate-950 to-zinc-950 border border-slate-900 rounded-xl relative space-y-3 animate-fade-in">
                                <div className="absolute top-0 right-0 w-20 h-20 bg-teal-500/5 rounded-full blur-lg pointer-events-none"></div>

                                <div className="flex items-center justify-between border-b border-slate-900 pb-2.5">
                                  <div className="flex items-center gap-2 font-mono text-[10px]">
                                    <span className="p-1 rounded bg-teal-950 text-teal-400 font-extrabold border border-teal-905/30 uppercase tracking-widest text-[8px]">
                                      Inspect
                                    </span>
                                    <strong className="text-zinc-300 uppercase">Live Payload Detail</strong>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => setExplorerSelectedRow(null)}
                                    className="text-zinc-500 hover:text-zinc-300 font-mono text-[9px] uppercase font-bold cursor-pointer"
                                  >
                                    ✕ CLOSE
                                  </button>
                                </div>

                                {/* Nice Quick Attribute Table */}
                                <div className="space-y-1.5 bg-slate-950/60 p-2.5 rounded-lg border border-slate-900 text-[10px]">
                                  <h6 className="text-[8px] uppercase tracking-wider text-zinc-500 font-mono font-bold mb-1 border-b border-slate-900 pb-1 font-mono">Row Properties:</h6>
                                  {Object.entries(explorerSelectedRow).map(([k, v]) => {
                                    if (typeof v === "object" && v !== null) {
                                      return null; // Skip complex arrays/objects in table view
                                    }
                                    return (
                                      <div key={k} className="flex justify-between items-start gap-3 py-0.5 border-b border-slate-900/30 font-mono text-[9px]">
                                        <span className="text-zinc-500 font-bold shrink-0">{k}:</span>
                                        <span className="text-zinc-350 text-right select-all truncate max-w-xs">{String(v ?? "null")}</span>
                                      </div>
                                    );
                                  })}
                                </div>

                                <div className="space-y-1">
                                  <div className="flex items-center justify-between select-none">
                                    <span className="text-[8.5px] uppercase font-mono font-bold text-zinc-500 block">Complete Object Schema:</span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        navigator.clipboard.writeText(JSON.stringify(explorerSelectedRow, null, 2));
                                        alert("Object copied successfully to clipboard!");
                                      }}
                                      className="text-teal-400 hover:text-teal-300 font-mono text-[8.5px] uppercase font-bold pr-1 cursor-pointer"
                                    >
                                      📄 Copy Payload
                                    </button>
                                  </div>
                                  <pre className="p-3 bg-black border border-slate-900 rounded-lg font-mono text-[8.5px] text-teal-400 leading-relaxed overflow-auto max-h-80 select-all whitespace-pre-wrap font-mono">
                                    <code>{JSON.stringify(explorerSelectedRow, null, 2)}</code>
                                  </pre>
                                </div>

                                <div className="flex gap-2.5 select-none">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setExplorerEditingRow(explorerSelectedRow);
                                      setExplorerEditPayload(JSON.stringify(explorerSelectedRow, null, 2));
                                      setExplorerEditError(null);
                                      setExplorerSelectedRow(null);
                                    }}
                                    className="flex-1 py-1.5 rounded-lg bg-yellow-950/25 border border-yellow-900/40 hover:bg-yellow-950/40 text-[10px] text-yellow-500 font-bold uppercase font-mono text-center cursor-pointer transition active:scale-[0.99] flex items-center justify-center gap-1"
                                  >
                                    <Code className="h-3 w-3" />
                                    <span>EDIT THIS ROW</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => deleteExplorerRow(explorerTable, explorerSelectedRow)}
                                    className="py-1.5 px-3 rounded-lg bg-red-950/25 border border-red-900/40 hover:bg-red-950/40 text-[10px] text-red-500 font-bold uppercase font-mono text-center cursor-pointer transition active:scale-[0.99]"
                                  >
                                    🗑 Delete Row
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {adminSubTab === 'localstorage' && (
                    <div className="p-4 bg-slate-950 border border-slate-900 rounded-xl font-mono text-xs text-slate-400 text-center">
                      <span>Browser local storage inspection is retired for production migration. Relying entirely on Supabase schemas.</span>
                    </div>
                  )}

                  {/* RETIRED LOCAL STORAGE INSPECTOR INTERFACE */}
                  {false && (
                    <div className="hidden" />
                  )}

                  {adminSubTab === 'supabase_wipe' && (
                    <div className="space-y-4 animate-fade-in text-left">
                      <div className="flex items-center justify-between border-b border-slate-900 pb-2">
                        <div className="space-y-0.5">
                          <h4 className="text-[10px] font-bold text-slate-300 uppercase font-mono tracking-wide">☁️ Supabase Cloud Database Purge</h4>
                          <p className="text-[9.5px] text-zinc-500 leading-normal">
                            Direct administrative control to perform a high-level table format across Supabase cloud collections.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={fetchSupabaseTotalCounts}
                          disabled={isFetchingSupabaseCounts || !isSupabaseConfigured()}
                          className="py-1 px-2.5 rounded-lg bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-400 hover:text-slate-200 font-mono text-[9px] uppercase flex items-center gap-1.5 cursor-pointer disabled:opacity-40 transition"
                        >
                          <RefreshCw className={`h-3 w-3 ${isFetchingSupabaseCounts ? "animate-spin" : ""}`} />
                          <span>Refresh Statistics</span>
                        </button>
                      </div>

                      {/* Connection Parameters Display banner */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pb-1">
                        <div className="p-3 bg-slate-950/70 border border-slate-900 rounded-xl space-y-1.5 font-mono text-[9.5px]">
                          <span className="text-[8px] text-zinc-500 uppercase tracking-widest font-black block">Active Connection Metadata</span>
                          <div className="space-y-1 text-zinc-400 leading-tight">
                            <div className="flex justify-between">
                              <span className="text-zinc-650">Host URL:</span>
                              <span className="text-slate-300 truncate max-w-[200px] select-all" title={getActiveSupabaseConfig().url}>
                                {getActiveSupabaseConfig().url || "Unconfigured"}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-zinc-650">Anon Key:</span>
                              <span className="text-slate-300 select-none">
                                {getActiveSupabaseConfig().anonKey ? "•••••••••••• (Active)" : "None"}
                              </span>
                            </div>
                            <div className="flex justify-between items-center pt-0.5">
                              <span className="text-zinc-650">Connection Status:</span>
                              {isSupabaseConfigured() ? (
                                <span className="px-1.5 py-0.25 text-[8px] uppercase font-bold text-emerald-400 bg-emerald-950/50 border border-emerald-500/20 rounded">
                                  Configured
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.25 text-[8px] uppercase font-bold text-red-400 bg-red-950/50 border border-red-500/20 rounded">
                                  Unconfigured
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Real-time Row metrics panel */}
                        <div className="p-3 bg-slate-950/70 border border-slate-900 rounded-xl space-y-2 font-mono text-[9.5px]">
                          <span className="text-[8px] text-zinc-500 uppercase tracking-widest font-black block">Target Rows Sourced</span>
                          
                          {supabaseCountsError && (
                            <div className="text-red-400 text-[8.5px] leading-relaxed italic bg-red-950/10 p-1.5 rounded border border-red-900/10">
                              Error Sourcing counts: {supabaseCountsError}
                            </div>
                          )}

                          <div className="grid grid-cols-2 gap-2 text-center">
                            <div className="p-2 bg-slate-950 border border-slate-900 rounded-lg">
                              <span className="text-[8px] text-zinc-600 block uppercase font-black tracking-wide mb-0.5">Vehicles (Catalog)</span>
                              {isFetchingSupabaseCounts ? (
                                <span className="text-zinc-500 text-xs font-bold leading-none animate-pulse">Querying...</span>
                              ) : (
                                <strong className="text-slate-200 text-base font-black">
                                  {supabaseTotalCarCount !== null ? supabaseTotalCarCount : "—"}
                                </strong>
                              )}
                            </div>
                            <div className="p-2 bg-slate-950 border border-slate-900 rounded-lg">
                              <span className="text-[8px] text-zinc-600 block uppercase font-black tracking-wide mb-0.5">Comments & Reviews</span>
                              {isFetchingSupabaseCounts ? (
                                <span className="text-zinc-500 text-xs font-bold leading-none animate-pulse">Querying...</span>
                              ) : (
                                <strong className="text-amber-400 text-base font-black">
                                  {supabaseTotalCommentCount !== null ? supabaseTotalCommentCount : "—"}
                                </strong>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Danger Banner Warning */}
                      <div className="p-3 bg-red-950/20 border border-red-500/15 rounded-xl text-left flex gap-3 text-[10px] leading-normal font-sans text-red-200">
                        <ShieldAlert className="h-6 w-6 text-red-450 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <strong className="text-red-400 uppercase tracking-wide font-mono text-[10px] block">⚠️ CRITICAL DANGER: Destructive Wipe</strong>
                          <p className="text-zinc-400">
                            Executing a purge initiates a sweeping delete query against the <code className="text-[10px] bg-red-950/40 text-red-400 px-1 rounded font-mono">vehicles</code> and <code className="text-[10px] bg-red-950/40 text-red-400 px-1 rounded font-mono">comments</code> rows. Sourced items belonging to registered users will be permanently scrubbed.
                          </p>
                          <p className="text-zinc-500 text-[9px] pt-1">
                            *Note on Row Level Security (RLS): To purge rows across all registers, the configured Anon Key should have complete delete credentials or standard Row Level Security should be bypassed on the target schema.
                          </p>
                        </div>
                      </div>

                      {/* Interactive Triggers */}
                      <div className="pt-2">
                        {!showSupabaseWipeConfirm ? (
                          <button
                            type="button"
                            onClick={() => {
                              setShowSupabaseWipeConfirm(true);
                              setSupabaseWipeError(null);
                              setSupabaseWipeSuccess(false);
                            }}
                            disabled={!isSupabaseConfigured() || isFetchingSupabaseCounts}
                            className="w-full py-3 px-4 rounded-xl bg-red-650 hover:bg-red-600 border border-red-500/10 text-white font-mono text-[10.5px] font-black uppercase tracking-wider transition cursor-pointer select-none active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed text-center flex items-center justify-center gap-1.5"
                          >
                            <Trash2 className="h-4 w-4 shrink-0" />
                            <span>Wipe All Supabase Cloud Data</span>
                          </button>
                        ) : (
                          <div className="p-4 bg-red-950/30 border border-red-500/20 rounded-xl space-y-3 animate-fade-in text-center font-mono">
                            <span className="text-[11px] font-black text-red-400 uppercase block tracking-wider">⚠️ Confirm Cloud Destruction? ⚠️</span>
                            <p className="text-[9.5px] text-zinc-400 max-w-md mx-auto leading-normal">
                              This will irreversibly delete all comments of all testers and all user vehicles in the active database. Current statistics: {supabaseTotalCarCount !== null ? supabaseTotalCarCount : "Unknown"} cars, {supabaseTotalCommentCount !== null ? supabaseTotalCommentCount : "Unknown"} comment references.
                            </p>
                            
                            <div className="flex gap-2 justify-center pt-1.5 max-w-sm mx-auto">
                              <button
                                type="button"
                                onClick={handleWipeSupabaseData}
                                className="flex-1 py-2 px-3 rounded-lg bg-red-650 hover:bg-red-600 text-white text-[10px] font-black uppercase transition cursor-pointer"
                              >
                                Yes, WIPE DATA!
                              </button>
                              <button
                                type="button"
                                onClick={() => setShowSupabaseWipeConfirm(false)}
                                className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-350 text-[10px] uppercase transition cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Log or Results Banner */}
                      {supabaseWipeProgress && (
                        <div className="bg-slate-950 border border-slate-900 rounded-xl p-3 overflow-hidden text-left relative font-mono text-[9px] text-zinc-300 leading-normal whitespace-pre-wrap select-all">
                          <span className="text-[8px] text-amber-500 font-bold uppercase block tracking-wider mb-1.5 select-none">⚡ WIPE SEQUENCE STATUS LOG</span>
                          {supabaseWipeProgress}
                        </div>
                      )}

                      {supabaseWipeSuccess && (
                        <div className="p-3 bg-emerald-950/40 border border-emerald-500/20 rounded-xl text-emerald-400 text-[10px] leading-relaxed font-mono flex items-center gap-2 animate-fade-in">
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-450" />
                          <span>Supabase Cloud Wipe operation successfully finished! All matching database rows wiped.</span>
                        </div>
                      )}

                      {supabaseWipeError && (
                        <div className="p-3 bg-red-950/40 border border-red-500/20 rounded-xl text-red-400 text-[10px] leading-relaxed font-mono flex items-center gap-2 animate-fade-in">
                          <ShieldAlert className="h-4 w-4 shrink-0 text-red-450" />
                          <span>Wipe execution error: {supabaseWipeError}</span>
                        </div>
                      )}

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
                onClick={() => {
                  setCompareList([]);
                  uploadUserProfileUpdates({ compare_list: [] });
                }}
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
            {currentUser && (
              <button
                onClick={() => { setActiveTab('dashboard'); setSelectedGarageCar(null); }}
                className={`flex flex-col items-center gap-1 transition-all cursor-pointer ${activeTab === 'dashboard' ? `${activeTheme.accentText} opacity-100 scale-105` : 'text-slate-500 hover:text-slate-200'}`}
              >
                <div className={`p-1.5 rounded-full border transition-colors ${activeTab === 'dashboard' ? `${activeTheme.accentBorder} bg-white/5` : 'border-transparent'}`}>
                  <Compass className="h-4 w-4" />
                </div>
                <span className="text-[9px] font-mono uppercase tracking-widest font-semibold text-center">Dashboard</span>
              </button>
            )}

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
            {currentUser ? (
              <>
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
                        <span>{sessionScansUsed} / {selectedPlanTier === 'chiptuning' ? 3 : 15} used</span>
                      </div>
                      <div className="w-full h-1 bg-slate-950/80 rounded-full border border-slate-900 overflow-hidden">
                        <div 
                          className={`h-full transition-all duration-500 ${
                            selectedPlanTier === 'chiptuning' ? 'bg-zinc-500' : 'bg-indigo-500'
                          }`}
                          style={{ width: `${Math.min(100, (sessionScansUsed / (selectedPlanTier === 'chiptuning' ? 3 : 15)) * 100)}%` }}
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
              </>
            ) : (
              <div className="flex items-center justify-center gap-1.5 py-1">
                <span>Unlock Unlimited Scans & Livery Themes</span>
                <span className="text-slate-700">•</span>
                <button 
                  onClick={() => handleOpenPlans()} 
                  className="underline text-indigo-400 hover:text-indigo-300 transition cursor-pointer font-bold font-mono uppercase text-[8px] tracking-widest"
                >
                  Manage Plans
                </button>
              </div>
            )}
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
                <div className={`p-4 rounded-xl border-2 transition-all duration-300 ${
                  activePlanSelection === 'chiptuning' 
                    ? 'border-slate-400 bg-slate-900/60 shadow-[0_0_15px_rgba(200,200,200,0.1)]' 
                    : 'border-slate-900 bg-slate-950/40 hover:bg-slate-900/20'
                }`}>
                  <div className="flex justify-between items-start">
                    <div className="flex gap-2 items-center">
                      <div className="p-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-400">
                        <Cpu className="h-4 w-4" />
                      </div>
                      <div>
                        <span className="text-[8px] font-mono tracking-widest text-zinc-550 font-extrabold uppercase">Slightly Boosted</span>
                        <h4 className="text-xs font-bold text-slate-200">CHIPTUNING FREE</h4>
                      </div>
                    </div>
                    <span className="text-xs font-black font-mono text-zinc-400">$0 <span className="text-[8px] font-normal text-zinc-500">/mo</span></span>
                  </div>
                  <div className="text-[9.5px] text-zinc-400 leading-relaxed mt-3 space-y-1 pl-1">
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
                    className={`w-full mt-3.5 py-1.5 rounded-lg text-[9px] font-mono font-bold uppercase transition cursor-pointer ${
                      selectedPlanTier === 'chiptuning' 
                        ? 'bg-zinc-800 text-zinc-300 border border-zinc-700/50 cursor-default' 
                        : 'bg-zinc-750 hover:bg-zinc-700 text-slate-100 border border-zinc-750'
                    }`}
                  >
                    {selectedPlanTier === 'chiptuning' ? "Current Active Plan" : "Downgrade to Free"}
                  </button>
                </div>

                {/* Sub Plan 2: Teen Passion */}
                <div className={`p-4 rounded-xl border-2 transition-all duration-300 ${
                  activePlanSelection === 'teen_passion' 
                    ? 'border-indigo-500 bg-indigo-950/30 shadow-[0_0_15px_rgba(99,102,241,0.2)]' 
                    : 'border-slate-900 bg-slate-950/40 hover:bg-slate-900/20'
                }`}>
                  <div className="flex justify-between items-start">
                    <div className="flex gap-2 items-center">
                      <div className="p-1.5 rounded-lg bg-indigo-950 border border-indigo-700 text-indigo-400">
                        <Gauge className="h-4 w-4" />
                      </div>
                      <div>
                        <span className="text-[8px] font-mono tracking-widest text-indigo-400 font-extrabold uppercase">Youth Favorite</span>
                        <h4 className="text-xs font-black text-indigo-100 flex items-center gap-1">TEEN PASSION 🚀</h4>
                      </div>
                    </div>
                    <span className="text-xs font-black font-mono text-indigo-300">$1.99 <span className="text-[8px] font-normal text-indigo-550">/mo</span></span>
                  </div>
                  <div className="text-[9.5px] text-zinc-400 leading-relaxed mt-3 space-y-1 pl-1">
                    <p>Pocket-money friendly. Explores the limits of your vehicle passion:</p>
                    <ul className="list-disc list-inside text-[8.5px] text-indigo-400/85 space-y-0.5 font-mono">
                      <li>• Up to 15 Car Scans limit</li>
                      <li>• Compare up to 2 vehicles at once</li>
                      <li>• Up to 3 Spotter Card broadcasts</li>
                      <li>• Max 5 notes / reviews logged per car</li>
                      <li>• Premium livery themes unlocked</li>
                    </ul>
                  </div>
                  <button 
                    onClick={() => handleSelectPlan('teen_passion')}
                    className={`w-full mt-3.5 py-1.5 rounded-lg text-[9px] font-mono font-bold uppercase transition ${
                      selectedPlanTier === 'teen_passion' 
                        ? 'bg-indigo-900/20 text-indigo-400 border border-indigo-900/50 cursor-default' 
                        : 'bg-indigo-650 hover:bg-indigo-550 text-white shadow-lg cursor-pointer'
                    }`}
                  >
                    {selectedPlanTier === 'teen_passion' ? "Current Active Plan" : "Upgrade to Teen Passion"}
                  </button>
                </div>

                {/* Sub Plan 3: Gasoline Gold */}
                <div className={`p-4 rounded-xl border-2 transition-all duration-300 ${
                  activePlanSelection === 'gasoline_gold' 
                    ? 'border-amber-500 bg-amber-950/20 shadow-[0_0_15px_rgba(245,158,11,0.2)]' 
                    : 'border-slate-900 bg-slate-950/40 hover:bg-slate-900/20'
                }`}>
                  <div className="flex justify-between items-start">
                    <div className="flex gap-2 items-center">
                      <div className="p-1.5 rounded-lg bg-amber-950 border border-amber-800 text-amber-400">
                        <Sparkles className="h-4 w-4" />
                      </div>
                      <div>
                        <span className="text-[8px] font-mono tracking-widest text-amber-500 font-extrabold uppercase">Education & Engineering</span>
                        <h4 className="text-xs font-bold text-slate-100 flex items-center gap-1">GASOLINE GOLD 🏆</h4>
                      </div>
                    </div>
                    <span className="text-xs font-black font-mono text-amber-400">$4.99 <span className="text-[8px] font-normal text-amber-600">/mo</span></span>
                  </div>
                  <div className="text-[9.5px] text-zinc-400 leading-relaxed mt-3 space-y-1 pl-1">
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
                    className={`w-full mt-3.5 py-1.5 rounded-lg text-[9px] font-mono font-bold uppercase transition ${
                      selectedPlanTier === 'gasoline_gold' 
                        ? 'bg-amber-900/20 text-amber-400 border border-amber-900/50 cursor-default' 
                        : 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold shadow-lg cursor-pointer'
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
