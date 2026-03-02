"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { getHealthCapacity, type HealthCapacity, type PromMetric } from "@/lib/api";

function fmtVal(v: string | undefined): string {
  const n = parseFloat(v ?? "");
  if (isNaN(n)) return "—";
  return n.toFixed(3);
}

function fmtBytes(v: string | undefined): string {
  const n = parseFloat(v ?? "");
  if (isNaN(n)) return "—";
  if (n >= 1_073_741_824) return `${(n / 1_073_741_824).toFixed(1)} GiB`;
  if (n >= 1_048_576)     return `${(n / 1_048_576).toFixed(0)} MiB`;
  return `${(n / 1024).toFixed(0)} KiB`;
}

function fmtCpu(v: string | undefined): string {
  const n = parseFloat(v ?? "");
  if (isNaN(n)) return "—";
  if (n < 0.001) return `${(n * 1_000_000).toFixed(0)}μ`;
  if (n < 1)     return `${(n * 1000).toFixed(1)}m`;
  return `${n.toFixed(3)} core`;
}

// ── CPU ratio section ─────────────────────────────────────────────────────────

function CpuRatioSection({ ratio, abs }: { ratio: PromMetric[]; abs: PromMetric[] }) {
  // Build lookup from abs for namespaces without ratio data
  const absMap: Record<string, string> = {};
  for (const m of abs) absMap[m.metric.namespace || ""] = m.value?.[1] ?? "";

  // Use ratio data if available, else fall back to abs
  const rows = ratio.length > 0 ? ratio : abs;

  return (
    <div className="bg-white border rounded-lg p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">
        CPU Kullanım / Request Oranı (namespace)
        <span className="ml-2 text-xs text-gray-400 font-normal">
          {ratio.length > 0 ? "usage ÷ request" : "sadece mutlak kullanım (request tanımsız)"}
        </span>
      </h3>
      {rows.length === 0 ? (
        <p className="text-gray-400 text-xs italic">Veri yok</p>
      ) : (
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="text-gray-500 uppercase tracking-wide">
              <th className="px-3 py-2 text-left border-b">Namespace</th>
              <th className="px-3 py-2 text-left border-b">
                {ratio.length > 0 ? "Oran (usage/request)" : "CPU Kullanım"}
              </th>
              <th className="px-3 py-2 text-left border-b">Durum</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m, i) => {
              const ns  = m.metric.namespace || "—";
              const val = parseFloat(m.value?.[1] ?? "");
              const isRatio = ratio.length > 0;
              const color =
                isRatio && val >= 1.0   ? "text-red-600 font-bold" :
                isRatio && val >= 0.75  ? "text-yellow-600 font-semibold" :
                                          "text-gray-700";
              const badge =
                isRatio && val >= 1.0  ? <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700 text-xs font-semibold">Limit üstü</span> :
                isRatio && val >= 0.75 ? <span className="px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700 text-xs font-semibold">Yüksek</span> :
                                          null;
              return (
                <tr key={i} className="border-b hover:bg-gray-50">
                  <td className="px-3 py-1.5 font-mono max-w-[200px] truncate" title={ns}>{ns}</td>
                  <td className={`px-3 py-1.5 font-mono font-semibold ${color}`}>
                    {isRatio ? (isNaN(val) ? "—" : `${(val * 100).toFixed(1)}%`) : fmtCpu(m.value?.[1])}
                  </td>
                  <td className="px-3 py-1.5">{badge}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ── Quota section ─────────────────────────────────────────────────────────────

function QuotaSection({ used, hard }: { used: PromMetric[]; hard: PromMetric[] }) {
  // Build hard map keyed by namespace+resource
  const hardMap: Record<string, number> = {};
  for (const m of hard) {
    const k = `${m.metric.namespace}|${m.metric.resource}`;
    hardMap[k] = parseFloat(m.value?.[1] ?? "");
  }

  return (
    <div className="bg-white border rounded-lg p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">ResourceQuota Kullanımı</h3>
      {used.length === 0 ? (
        <p className="text-gray-400 text-xs italic">ResourceQuota tanımlı değil</p>
      ) : (
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="text-gray-500 uppercase tracking-wide">
              <th className="px-3 py-2 text-left border-b">Namespace</th>
              <th className="px-3 py-2 text-left border-b">Resource</th>
              <th className="px-3 py-2 text-left border-b">Kullanım</th>
              <th className="px-3 py-2 text-left border-b">Limit</th>
              <th className="px-3 py-2 text-left border-b">Oran</th>
            </tr>
          </thead>
          <tbody>
            {used.map((m, i) => {
              const k        = `${m.metric.namespace}|${m.metric.resource}`;
              const usedVal  = parseFloat(m.value?.[1] ?? "");
              const hardVal  = hardMap[k];
              const ratio    = hardVal > 0 ? usedVal / hardVal : null;
              const pct      = ratio !== null ? (ratio * 100).toFixed(1) + "%" : "—";
              const color    = ratio !== null && ratio >= 0.9 ? "text-red-600 font-bold" :
                               ratio !== null && ratio >= 0.7 ? "text-yellow-600" : "text-gray-600";
              const resource = m.metric.resource || "—";
              const isMem    = resource.includes("memory");
              const fmt      = isMem ? fmtBytes : fmtVal;
              return (
                <tr key={i} className="border-b hover:bg-gray-50">
                  <td className="px-3 py-1.5 font-mono max-w-[160px] truncate" title={m.metric.namespace}>{m.metric.namespace || "—"}</td>
                  <td className="px-3 py-1.5 font-mono text-gray-600">{resource}</td>
                  <td className="px-3 py-1.5 font-mono">{isMem ? fmtBytes(m.value?.[1]) : fmtVal(m.value?.[1])}</td>
                  <td className="px-3 py-1.5 font-mono text-gray-500">{isNaN(hardVal) ? "—" : (isMem ? fmtBytes(String(hardVal)) : hardVal.toFixed(3))}</td>
                  <td className={`px-3 py-1.5 font-semibold tabular-nums ${color}`}>{pct}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ── PVC section ───────────────────────────────────────────────────────────────

function PvcSection({ rows }: { rows: PromMetric[] }) {
  return (
    <div className="bg-white border rounded-lg p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">PVC Doluluk Oranı (&gt;50%)</h3>
      {rows.length === 0 ? (
        <p className="text-green-600 text-xs">%50 üzeri PVC yok</p>
      ) : (
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="text-gray-500 uppercase tracking-wide">
              <th className="px-3 py-2 text-left border-b">Namespace</th>
              <th className="px-3 py-2 text-left border-b">PVC / Mount</th>
              <th className="px-3 py-2 text-left border-b">Doluluk</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m, i) => {
              const pct = parseFloat(m.value?.[1] ?? "") * 100;
              const color = pct >= 90 ? "text-red-600 font-bold" : pct >= 70 ? "text-yellow-600 font-semibold" : "text-gray-700";
              return (
                <tr key={i} className="border-b hover:bg-gray-50">
                  <td className="px-3 py-1.5 font-mono max-w-[150px] truncate">{m.metric.namespace || m.metric.exported_namespace || "—"}</td>
                  <td className="px-3 py-1.5 font-mono max-w-[200px] truncate" title={m.metric.persistentvolumeclaim || m.metric.mountpoint}>
                    {m.metric.persistentvolumeclaim || m.metric.mountpoint || "—"}
                  </td>
                  <td className={`px-3 py-1.5 font-semibold tabular-nums ${color}`}>{pct.toFixed(1)}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PanelCapacity({ cluster }: { cluster: string }) {
  const [data, setData]       = useState<HealthCapacity | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await getHealthCapacity(cluster));
    } catch (e) { setError(String(e)); }
    finally      { setLoading(false); }
  }, [cluster]);

  useEffect(() => { load(); const t = setInterval(load, 15_000); return () => clearInterval(t); }, [load]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-5 py-3 border-b shrink-0">
        <span className="text-sm font-medium text-gray-600">Kapasite</span>
        {loading && <span className="text-xs text-gray-400 animate-pulse">Yenileniyor...</span>}
        <button onClick={load} className="ml-auto text-xs px-2 py-1 border rounded hover:bg-gray-50 text-gray-500">↻ Yenile</button>
      </div>

      <div className="flex-1 overflow-auto p-5 space-y-4">
        {error && <p className="text-red-600 text-sm">{error}</p>}
        {!cluster && <p className="text-gray-400 text-sm italic">Cluster seçin.</p>}

        {data && (
          <>
            <CpuRatioSection ratio={data.cpu_ratio} abs={data.cpu_abs} />
            <QuotaSection used={data.quota_used} hard={data.quota_hard} />
            <PvcSection rows={data.pvc_ratio} />
          </>
        )}
      </div>
    </div>
  );
}
