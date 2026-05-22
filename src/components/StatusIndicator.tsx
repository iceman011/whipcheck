import { useState, useEffect } from "react";
import { Sparkles, CheckCircle2, AlertTriangle, RefreshCw } from "lucide-react";

interface HealthStatus {
  status: string;
  apiKeyConfigured: boolean;
}

export default function StatusIndicator() {
  const [status, setStatus] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  async function checkHealth() {
    setLoading(true);
    setError(false);
    try {
      const response = await fetch("/api/health");
      if (response.ok) {
        const data = await response.json();
        setStatus(data);
      } else {
        setError(true);
      }
    } catch (err) {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    checkHealth();
  }, []);

  return (
    <div className="flex items-center justify-between gap-3 bg-slate-900/60 backdrop-blur-md px-4 py-2 rounded-full border border-slate-850 text-xs font-mono select-none">
      <div className="flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          {error ? (
            <span className="absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75 animate-ping"></span>
          ) : (
            <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping"></span>
          )}
          <span className={`relative inline-flex rounded-full h-2 w-2 ${error ? 'bg-red-500' : 'bg-emerald-500'}`}></span>
        </span>
        <span className="text-slate-400">Back-End:</span>
        <span className={error ? "text-red-400 font-semibold" : "text-emerald-400 font-semibold"}>
          {loading ? "Checking..." : error ? "CONNECTION LOST" : "ONLINE"}
        </span>
      </div>

      <div className="flex items-center gap-2">
        {loading ? (
          <RefreshCw className="h-3 w-3 text-slate-500 animate-spin" />
        ) : error ? (
          <div className="flex items-center gap-1 text-red-400">
            <AlertTriangle className="h-3 w-3" />
            <span>Setup Incomplete</span>
          </div>
        ) : status?.apiKeyConfigured ? (
          <div className="flex items-center gap-1 text-teal-400">
            <Sparkles className="h-3.5 w-3.5 animate-pulse" />
            <span>AI Ready</span>
          </div>
        ) : (
          <button 
            onClick={checkHealth}
            className="flex items-center gap-1 text-amber-400 hover:underline cursor-pointer"
          >
            <AlertTriangle className="h-3 w-3 text-amber-500" />
            <span>Configure AI Key</span>
          </button>
        )}
      </div>
    </div>
  );
}
