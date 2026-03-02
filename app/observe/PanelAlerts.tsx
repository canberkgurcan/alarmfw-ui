"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { getHealthAlerts, type HealthAlert } from "@/lib/api";

function fmtDuration(secs: number | null): string {
  if (secs === null || secs < 0) return "—";
  const s = Math.round(secs);
  if (s < 60)      return `${s}s`;
  if (s < 3600)    return `${Math.floor(s / 60)}m ${s % 60}s`;
  if (s < 86400)   return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
  return `${Math.floor(s / 86400)}d ${Math.floor((s % 86400) / 3600)}h`;
}

const SEV_ORDER: Record<string, number> = { critical: 0, warning: 1, error: 2, info: 3 };

function sevClass(sev: string): string {
  if (sev === "critical") return "bg-red-100 text-red-700";
  if (sev === "warning")  return "bg-yellow-100 text-yellow-700";
  if (sev === "error")    return "bg-orange-100 text-orange-700";
  return "bg-blue-50 text-blue-600";
}

function sorted(alerts: HealthAlert[]): HealthAlert[] {
  return [...alerts].sort((a, b) => {
    const sa = SEV_ORDER[(a.metric.severity || "").toLowerCase()] ?? 9;
    const sb = SEV_ORDER[(b.metric.severity || "").toLowerCase()] ?? 9;
    if (sa !== sb) return sa - sb;
    return (b.active_secs ?? 0) - (a.active_secs ?? 0);
  });
}

export default function PanelAlerts({ cluster }: { cluster: string }) {
  const [data, setData]       = useState<HealthAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  // filters
  const [fSev,  setFSev]  = useState("");
  const [fNs,   setFNs]   = useState("");
  const [fName, setFName] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const r = await getHealthAlerts(cluster);
      if (!r.ok) { setError(r.error || "Hata"); setData([]); }
      else        setData(r.result);
    } catch (e) { setError(String(e)); setData([]); }
    finally      { setLoading(false); }
  }, [cluster]);

  useEffect(() => { load(); const t = setInterval(load, 15_000); return () => clearInterval(t); }, [load]);

  const alerts = useMemo(() => sorted(data), [data]);

  const severities = useMemo(() =>
    Array.from(new Set(alerts.map((a) => a.metric.severity).filter(Boolean))).sort(),
  [alerts]);
  const namespaces = useMemo(() =>
    Array.from(new Set(alerts.map((a) => a.metric.namespace).filter(Boolean))).sort(),
  [alerts]);
  const names = useMemo(() =>
    Array.from(new Set(alerts.map((a) => a.metric.alertname).filter(Boolean))).sort(),
  [alerts]);

  const filtered = useMemo(() => alerts.filter((a) => {
    if (fSev  && a.metric.severity  !== fSev)  return false;
    if (fNs   && a.metric.namespace !== fNs)   return false;
    if (fName && a.metric.alertname !== fName) return false;
    return true;
  }), [alerts, fSev, fNs, fName]);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-5 py-3 border-b shrink-0 flex-wrap">
        {/* Counter */}
        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-bold ${
          filtered.length === 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
        }`}>
          {filtered.length} firing{filtered.length !== alerts.length ? `/${alerts.length}` : ""}
        </span>

        {/* Severity filter */}
        <select value={fSev} onChange={(e) => setFSev(e.target.value)} className="border rounded px-2 py-1.5 text-sm">
          <option value="">— Tüm severity —</option>
          {severities.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>

        {/* Namespace filter */}
        <select value={fNs} onChange={(e) => setFNs(e.target.value)} className="border rounded px-2 py-1.5 text-sm">
          <option value="">— Tüm namespace —</option>
          {namespaces.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>

        {/* Alert name filter */}
        <select value={fName} onChange={(e) => setFName(e.target.value)} className="border rounded px-2 py-1.5 text-sm">
          <option value="">— Tüm alertname —</option>
          {names.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>

        {(fSev || fNs || fName) && (
          <button onClick={() => { setFSev(""); setFNs(""); setFName(""); }}
            className="text-xs px-2 py-1 border rounded text-gray-500 hover:bg-gray-50">
            ✕ Temizle
          </button>
        )}

        {loading && <span className="text-xs text-gray-400 animate-pulse ml-auto">Yenileniyor...</span>}
        <button onClick={load} className="text-xs px-2 py-1 border rounded hover:bg-gray-50 text-gray-500 ml-auto">
          ↻ Yenile
        </button>
      </div>

      {/* Table */}
      <div className="flex-1 min-h-0 overflow-auto">
        {error ? (
          <p className="text-red-600 text-sm p-4">{error}</p>
        ) : filtered.length === 0 && !loading ? (
          <p className="text-green-600 text-sm italic p-4">
            {alerts.length === 0 ? "Aktif alert yok" : "Filtreyle eşleşen alert yok"}
          </p>
        ) : (
          <table className="w-full text-xs border-collapse">
            <thead className="sticky top-0 z-10 bg-gray-50">
              <tr className="text-gray-500 uppercase tracking-wide">
                {["Severity", "Alert Adı", "Namespace", "Pod / Instance", "Value", "Aktif Süre", "Ek Labellar"].map((h) => (
                  <th key={h} className="px-3 py-2 text-left border-b whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((a, i) => {
                const m = a.metric;
                const extra = Object.entries(m)
                  .filter(([k]) => !["alertname","alertstate","namespace","severity","pod","instance","__name__"].includes(k))
                  .map(([k, v]) => `${k}="${v}"`)
                  .join(", ");
                const val = a.value ? a.value[1] : "—";
                return (
                  <tr key={i} className={`border-b hover:bg-gray-50 ${
                    m.severity === "critical" ? "bg-red-50/30" :
                    m.severity === "warning"  ? "bg-yellow-50/20" : ""
                  }`}>
                    <td className="px-3 py-1.5">
                      {m.severity && (
                        <span className={`px-1.5 py-0.5 rounded font-semibold ${sevClass(m.severity)}`}>
                          {m.severity}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-1.5 font-mono font-semibold text-gray-800 max-w-[180px] truncate" title={m.alertname}>
                      {m.alertname || "—"}
                    </td>
                    <td className="px-3 py-1.5 font-mono text-gray-600 max-w-[130px] truncate" title={m.namespace}>
                      {m.namespace || "—"}
                    </td>
                    <td className="px-3 py-1.5 font-mono text-gray-600 max-w-[160px] truncate" title={m.pod || m.instance}>
                      {m.pod || m.instance || "—"}
                    </td>
                    <td className="px-3 py-1.5 font-mono text-gray-700">{val}</td>
                    <td className="px-3 py-1.5 whitespace-nowrap font-mono">
                      <span className={a.active_secs && a.active_secs > 3600 ? "text-orange-600 font-semibold" : "text-gray-600"}>
                        {fmtDuration(a.active_secs)}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-gray-400 max-w-[240px] truncate" title={extra}>
                      {extra || "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
