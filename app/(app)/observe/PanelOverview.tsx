"use client";
import { useState, useEffect, useCallback } from "react";
import { getHealthOverview, type HealthOverview } from "@/lib/api";

type Tab = string;

interface Card {
  key: keyof HealthOverview;
  label: string;
  icon: string;
  okZero?: boolean;       // true = 0 is green
  warnThreshold?: number; // orange above this
  critThreshold?: number; // red above this
  targetTab?: Tab;
}

const CARDS: Card[] = [
  { key: "firing_alerts",           label: "Firing Alerts",         icon: "🔔", okZero: true, warnThreshold: 1,  critThreshold: 5,  targetTab: "alerts"   },
  { key: "crashloop",               label: "CrashLoopBackOff",      icon: "🔄", okZero: true, warnThreshold: 1,  critThreshold: 5,  targetTab: "workload" },
  { key: "oomkilled",               label: "OOMKilled",             icon: "💥", okZero: true, warnThreshold: 1,  critThreshold: 3,  targetTab: "workload" },
  { key: "imagepull",               label: "ImagePull Errors",      icon: "📦", okZero: true, warnThreshold: 1,  critThreshold: 3,  targetTab: "workload" },
  { key: "pending_pods",            label: "Pending Pods",          icon: "⏳", okZero: true, warnThreshold: 3,  critThreshold: 10, targetTab: "workload" },
  { key: "unavailable_deployments", label: "Unavail. Deployments",  icon: "⚠", okZero: true, warnThreshold: 1,  critThreshold: 3,  targetTab: "workload" },
  { key: "notready_nodes",          label: "NotReady Nodes",        icon: "🖥", okZero: true, warnThreshold: 1,  critThreshold: 2,  targetTab: "nodes"    },
  { key: "failed_jobs",             label: "Failed Jobs",           icon: "❌", okZero: true, warnThreshold: 1,  critThreshold: 5,  targetTab: "workload" },
];

function cardColor(val: number, card: Card): string {
  if (val < 0)                              return "border-gray-200 bg-gray-50 text-gray-400";
  if (card.okZero && val === 0)             return "border-green-200 bg-green-50";
  if (card.critThreshold && val >= card.critThreshold) return "border-red-300 bg-red-50";
  if (card.warnThreshold && val >= card.warnThreshold) return "border-yellow-300 bg-yellow-50";
  return "border-green-200 bg-green-50";
}

function valueColor(val: number, card: Card): string {
  if (val < 0)                              return "text-gray-300";
  if (card.okZero && val === 0)             return "text-green-600";
  if (card.critThreshold && val >= card.critThreshold) return "text-red-600";
  if (card.warnThreshold && val >= card.warnThreshold) return "text-yellow-600";
  return "text-green-600";
}

export default function PanelOverview({
  cluster,
  onNavigate,
}: {
  cluster: string;
  onNavigate: (tab: Tab) => void;
}) {
  const [data, setData]       = useState<HealthOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [lastAt, setLastAt]   = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const r = await getHealthOverview(cluster);
      setData(r);
      setLastAt(new Date());
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [cluster]);

  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [load]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3 border-b shrink-0">
        <span className="text-sm font-medium text-gray-600">Cluster Sağlık Özeti</span>
        {loading && <span className="text-xs text-gray-400 animate-pulse">Yenileniyor...</span>}
        {lastAt && !loading && (
          <span className="text-xs text-gray-400">
            {lastAt.toLocaleTimeString("tr-TR", { timeZone: "Europe/Istanbul" })} · 30 sn aralıkla güncellenir
          </span>
        )}
        <button
          onClick={load}
          className="ml-auto text-xs px-2 py-1 border rounded hover:bg-gray-50 text-gray-500"
        >
          ↻ Yenile
        </button>
      </div>

      <div className="flex-1 overflow-auto p-5">
        {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

        {!cluster && (
          <p className="text-gray-400 text-sm italic">Cluster seçin.</p>
        )}

        {cluster && data && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {CARDS.map((card) => {
              const val = data[card.key] as number;
              return (
                <button
                  key={card.key}
                  onClick={() => card.targetTab && onNavigate(card.targetTab)}
                  className={`flex flex-col items-start p-4 rounded-xl border-2 text-left transition-all hover:shadow-md ${cardColor(val, card)} ${card.targetTab ? "cursor-pointer" : "cursor-default"}`}
                >
                  <span className="text-2xl mb-2">{card.icon}</span>
                  <span className={`text-3xl font-bold tabular-nums ${valueColor(val, card)}`}>
                    {val < 0 ? "—" : val}
                  </span>
                  <span className="text-xs text-gray-500 mt-1 font-medium">{card.label}</span>
                </button>
              );
            })}
          </div>
        )}

        {cluster && !data && !loading && !error && (
          <p className="text-gray-400 text-sm italic">Veri bekleniyor...</p>
        )}
      </div>
    </div>
  );
}
