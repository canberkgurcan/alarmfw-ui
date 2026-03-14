"use client";
import { useState, useEffect, useCallback } from "react";
import { getHealthNodes, type HealthNodes, type PromMetric } from "@/lib/api";
import QueryErrorBanner from "./QueryErrorBanner";

function pct(m: PromMetric): number {
  return parseFloat(m.value?.[1] ?? "0");
}

function pctBar(val: number): { color: string; bg: string } {
  if (val >= 90) return { color: "bg-red-500",    bg: "bg-red-100"    };
  if (val >= 75) return { color: "bg-yellow-500", bg: "bg-yellow-100" };
  return           { color: "bg-green-500",  bg: "bg-green-100"  };
}

function PctRow({ label, val }: { label: string; val: number }) {
  const { color, bg } = pctBar(val);
  return (
    <div className="flex items-center gap-3 text-xs">
      <span className="w-40 truncate font-mono text-gray-700" title={label}>{label}</span>
      <div className={`flex-1 h-3 rounded-full ${bg} overflow-hidden`}>
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${Math.min(val, 100)}%` }} />
      </div>
      <span className={`w-12 text-right font-semibold tabular-nums ${val >= 90 ? "text-red-600" : val >= 75 ? "text-yellow-600" : "text-gray-600"}`}>
        {val.toFixed(1)}%
      </span>
    </div>
  );
}

function Section({ title, children, count, ok }: { title: string; children: React.ReactNode; count?: number; ok?: boolean }) {
  return (
    <div className="bg-white border rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
        {count !== undefined && (
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ok ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
            {count}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

export default function PanelNodes({ cluster }: { cluster: string }) {
  const [data, setData]       = useState<HealthNodes | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await getHealthNodes(cluster));
    } catch (e) { setError(String(e)); }
    finally      { setLoading(false); }
  }, [cluster]);

  useEffect(() => { load(); const t = setInterval(load, 15_000); return () => clearInterval(t); }, [load]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-5 py-3 border-b shrink-0">
        <span className="text-sm font-medium text-gray-600">Node Sağlığı</span>
        {loading && <span className="text-xs text-gray-400 animate-pulse">Yenileniyor...</span>}
        <button onClick={load} className="ml-auto text-xs px-2 py-1 border rounded hover:bg-gray-50 text-gray-500">↻ Yenile</button>
      </div>

      <QueryErrorBanner errors={data?.errors} />
      <div className="flex-1 overflow-auto p-5 space-y-4">
        {error && <p className="text-red-600 text-sm">{error}</p>}
        {!cluster && <p className="text-gray-400 text-sm italic">Cluster seçin.</p>}

        {data && (
          <>
            {/* NotReady nodes */}
            <Section title="NotReady Nodes" count={data.notready.length} ok={data.notready.length === 0}>
              {data.notready.length === 0 ? (
                <p className="text-green-600 text-xs">Tüm node'lar Ready</p>
              ) : (
                <div className="space-y-1">
                  {data.notready.map((m, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs bg-red-50 rounded px-3 py-1.5">
                      <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                      <span className="font-mono text-red-700 font-semibold">{m.metric.node || m.metric.instance || "—"}</span>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            {/* Pressure conditions */}
            <Section title="Node Pressure" count={data.pressure.length} ok={data.pressure.length === 0}>
              {data.pressure.length === 0 ? (
                <p className="text-green-600 text-xs">Baskı koşulu yok</p>
              ) : (
                <div className="space-y-1">
                  {data.pressure.map((m, i) => (
                    <div key={i} className="flex items-center gap-3 text-xs bg-yellow-50 rounded px-3 py-1.5">
                      <span className="font-mono text-gray-700 font-semibold">{m.metric.node || "—"}</span>
                      <span className="px-1.5 py-0.5 rounded bg-yellow-200 text-yellow-800 font-semibold">{m.metric.condition}</span>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            {/* CPU usage */}
            {data.cpu.length > 0 && (
              <Section title="Node CPU Kullanımı (%)">
                <div className="space-y-2">
                  {data.cpu.map((m, i) => (
                    <PctRow key={i} label={m.metric.node || m.metric.instance || "—"} val={pct(m)} />
                  ))}
                </div>
              </Section>
            )}

            {/* Memory usage */}
            {data.memory.length > 0 && (
              <Section title="Node Memory Kullanımı (%)">
                <div className="space-y-2">
                  {data.memory.map((m, i) => (
                    <PctRow key={i} label={m.metric.node || m.metric.instance || "—"} val={pct(m)} />
                  ))}
                </div>
              </Section>
            )}

            {/* Disk usage */}
            {data.disk.length > 0 && (
              <Section title="Node Disk Kullanımı - / (%)">
                <div className="space-y-2">
                  {data.disk.map((m, i) => (
                    <PctRow key={i} label={m.metric.node || m.metric.instance || "—"} val={pct(m)} />
                  ))}
                </div>
              </Section>
            )}

            {data.cpu.length === 0 && data.memory.length === 0 && data.disk.length === 0 && (
              <p className="text-gray-400 text-sm italic">node_exporter metrikleri bulunamadı.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
