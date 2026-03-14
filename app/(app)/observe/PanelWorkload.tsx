"use client";
import { useState, useEffect, useCallback } from "react";
import { getHealthWorkload, type HealthWorkload, type PromMetric } from "@/lib/api";
import QueryErrorBanner from "./QueryErrorBanner";

type WorkloadTab = "crashloop" | "oomkilled" | "imagepull" | "pending" | "unavailable" | "failed_jobs";

interface SubTab {
  key: WorkloadTab;
  label: string;
  icon: string;
  warnColor: string;
}

const SUB_TABS: SubTab[] = [
  { key: "crashloop",   label: "CrashLoop",       icon: "🔄", warnColor: "red"    },
  { key: "oomkilled",   label: "OOMKilled",        icon: "💥", warnColor: "red"    },
  { key: "imagepull",   label: "ImagePull",        icon: "📦", warnColor: "orange" },
  { key: "pending",     label: "Pending",          icon: "⏳", warnColor: "yellow" },
  { key: "unavailable", label: "Unavail. Deploy",  icon: "⚠",  warnColor: "orange" },
  { key: "failed_jobs", label: "Failed Jobs",      icon: "❌", warnColor: "red"    },
];

function badgeClass(color: string, count: number): string {
  if (count === 0) return "bg-green-100 text-green-700";
  if (color === "red")    return "bg-red-100 text-red-700";
  if (color === "orange") return "bg-orange-100 text-orange-700";
  return "bg-yellow-100 text-yellow-700";
}

function WorkloadTable({ rows, columns }: { rows: PromMetric[]; columns: string[] }) {
  if (!rows.length) return <p className="text-green-600 text-sm italic p-4">Sorun tespit edilmedi</p>;
  return (
    <table className="w-full text-xs border-collapse">
      <thead className="sticky top-0 z-10 bg-gray-50">
        <tr className="text-gray-500 uppercase tracking-wide">
          {columns.map((c) => (
            <th key={c} className="px-3 py-2 text-left border-b whitespace-nowrap">{c}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => {
          const m = r.metric;
          const val = r.value ? r.value[1] : "—";
          return (
            <tr key={i} className="border-b hover:bg-gray-50">
              <td className="px-3 py-1.5 font-mono max-w-[160px] truncate" title={m.namespace}>{m.namespace || "—"}</td>
              <td className="px-3 py-1.5 font-mono max-w-[220px] truncate" title={m.pod || m.deployment || m.job_name}>
                {m.pod || m.deployment || m.job_name || "—"}
              </td>
              {columns.length > 3 && (
                <td className="px-3 py-1.5 font-mono max-w-[120px] truncate">{m.container || m.reason || "—"}</td>
              )}
              <td className="px-3 py-1.5 font-semibold text-right tabular-nums">{val}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export default function PanelWorkload({ cluster }: { cluster: string }) {
  const [data, setData]       = useState<HealthWorkload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [activeTab, setActiveTab] = useState<WorkloadTab>("crashloop");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await getHealthWorkload(cluster));
    } catch (e) { setError(String(e)); }
    finally      { setLoading(false); }
  }, [cluster]);

  useEffect(() => { load(); const t = setInterval(load, 15_000); return () => clearInterval(t); }, [load]);

  const counts: Record<WorkloadTab, number> = {
    crashloop:   data?.crashloop.length   ?? 0,
    oomkilled:   data?.oomkilled.length   ?? 0,
    imagepull:   data?.imagepull.length   ?? 0,
    pending:     data?.pending.length     ?? 0,
    unavailable: data?.unavailable.length ?? 0,
    failed_jobs: data?.failed_jobs.length ?? 0,
  };

  const currentRows: PromMetric[] = data ? (data[activeTab] ?? []) : [];

  const colMap: Record<WorkloadTab, string[]> = {
    crashloop:   ["Namespace", "Pod", "Container", "Count"],
    oomkilled:   ["Namespace", "Pod", "Container", "Count"],
    imagepull:   ["Namespace", "Pod", "Reason",    "Count"],
    pending:     ["Namespace", "Pod", "",           "Count"],
    unavailable: ["Namespace", "Deployment", "",    "Count"],
    failed_jobs: ["Namespace", "Job", "",           "Count"],
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3 border-b shrink-0">
        <span className="text-sm font-medium text-gray-600">Workload Sorunları</span>
        {loading && <span className="text-xs text-gray-400 animate-pulse">Yenileniyor...</span>}
        <button onClick={load} className="ml-auto text-xs px-2 py-1 border rounded hover:bg-gray-50 text-gray-500">↻ Yenile</button>
      </div>

      <QueryErrorBanner errors={data?.errors} />
      {/* Sub-tabs */}
      <div className="flex gap-1 px-5 py-2 border-b shrink-0 flex-wrap bg-gray-50">
        {SUB_TABS.map((t) => {
          const cnt = counts[t.key];
          const isActive = activeTab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                isActive ? "bg-white border shadow-sm text-gray-800" : "text-gray-500 hover:bg-white hover:border hover:shadow-sm"
              }`}
            >
              {t.icon} {t.label}
              <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-xs font-bold ${badgeClass(t.warnColor, cnt)}`}>
                {cnt}
              </span>
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-auto">
        {error ? (
          <p className="text-red-600 text-sm p-4">{error}</p>
        ) : !cluster ? (
          <p className="text-gray-400 text-sm italic p-4">Cluster seçin.</p>
        ) : (
          <WorkloadTable
            rows={currentRows}
            columns={colMap[activeTab].filter(Boolean)}
          />
        )}
      </div>
    </div>
  );
}
