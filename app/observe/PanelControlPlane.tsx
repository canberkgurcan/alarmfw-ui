"use client";
import { useState, useEffect, useCallback } from "react";
import { getHealthControlPlane, type HealthControlPlane, type PromMetric } from "@/lib/api";
import QueryErrorBanner from "./QueryErrorBanner";

function fmtBytes(v: string | undefined): string {
  const n = parseFloat(v ?? "");
  if (isNaN(n)) return "—";
  if (n >= 1_073_741_824) return `${(n / 1_073_741_824).toFixed(2)} GiB`;
  if (n >= 1_048_576)     return `${(n / 1_048_576).toFixed(1)} MiB`;
  return `${(n / 1024).toFixed(0)} KiB`;
}

function fmtMs(v: string | undefined): string {
  const n = parseFloat(v ?? "");
  if (isNaN(n)) return "—";
  return `${(n * 1000).toFixed(1)} ms`;
}

function fmtRate(v: string | undefined): string {
  const n = parseFloat(v ?? "");
  if (isNaN(n)) return "—";
  return `${n.toFixed(3)} req/s`;
}

function fmtDays(secs: number): string {
  const d = secs / 86400;
  if (d < 1) return `${Math.floor(secs / 3600)}h`;
  return `${d.toFixed(1)}d`;
}

function StatusRow({ label, value, ok, warn }: { label: string; value: string; ok?: boolean; warn?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b last:border-0 text-sm">
      <span className="text-gray-500">{label}</span>
      <span className={`font-semibold ${ok === true ? "text-green-600" : warn ? "text-yellow-600" : ok === false ? "text-red-600" : "text-gray-800"}`}>
        {value}
      </span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border rounded-lg p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">{title}</h3>
      {children}
    </div>
  );
}

export default function PanelControlPlane({ cluster }: { cluster: string }) {
  const [data, setData]       = useState<HealthControlPlane | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await getHealthControlPlane(cluster));
    } catch (e) { setError(String(e)); }
    finally      { setLoading(false); }
  }, [cluster]);

  useEffect(() => { load(); const t = setInterval(load, 15_000); return () => clearInterval(t); }, [load]);

  // Parse helpers
  function firstVal(arr: PromMetric[]): string | undefined {
    return arr[0]?.value?.[1];
  }
  function sumVal(arr: PromMetric[]): number {
    return arr.reduce((a, m) => a + parseFloat(m.value?.[1] ?? "0"), 0);
  }

  const hasLeader    = data ? data.etcd_has_leader.some((m) => m.value?.[1] === "1") : null;
  const etcdDbBytes  = data ? firstVal(data.etcd_db_size) : undefined;
  const leaderChgRaw = data ? firstVal(data.etcd_leader_changes) : undefined;
  const leaderChg    = leaderChgRaw ? parseFloat(leaderChgRaw) : null;

  const apiserverErr  = data ? sumVal(data.apiserver_5xx_rate) : null;
  const certExpiry7d  = data ? sumVal(data.cert_expiry_7d) : null;

  // p99 latency: pick the worst verb
  const worstP99 = data?.apiserver_p99.reduce<[string, number] | null>((best, m) => {
    const v = parseFloat(m.value?.[1] ?? "");
    if (isNaN(v) || v === 0 || v === Infinity) return best;
    if (!best || v > best[1]) return [m.metric.verb || "—", v];
    return best;
  }, null);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-5 py-3 border-b shrink-0">
        <span className="text-sm font-medium text-gray-600">Kontrol Düzlemi</span>
        {loading && <span className="text-xs text-gray-400 animate-pulse">Yenileniyor...</span>}
        <button onClick={load} className="ml-auto text-xs px-2 py-1 border rounded hover:bg-gray-50 text-gray-500">↻ Yenile</button>
      </div>

      <QueryErrorBanner errors={data?.errors} />
      <div className="flex-1 overflow-auto p-5 space-y-4">
        {error && <p className="text-red-600 text-sm">{error}</p>}
        {!cluster && <p className="text-gray-400 text-sm italic">Cluster seçin.</p>}

        {data && (
          <>
            {/* etcd */}
            <Section title="etcd">
              {data.etcd_has_leader.length === 0 && data.etcd_db_size.length === 0 ? (
                <p className="text-gray-400 text-xs italic">etcd metrikleri bulunamadı (Prometheus etcd'yi scrape etmiyor olabilir)</p>
              ) : (
                <>
                  <StatusRow
                    label="Leader"
                    value={hasLeader === null ? "—" : hasLeader ? "Var" : "YOK"}
                    ok={hasLeader === true}
                    warn={hasLeader === false}
                  />
                  <StatusRow
                    label="DB Boyutu"
                    value={fmtBytes(etcdDbBytes)}
                    warn={parseFloat(etcdDbBytes ?? "0") > 4_294_967_296} // warn > 4 GiB
                  />
                  <StatusRow
                    label="Leader Değişimi (son 1h)"
                    value={leaderChg !== null ? leaderChg.toFixed(4) + " /s" : "—"}
                    ok={leaderChg !== null && leaderChg < 0.01}
                    warn={leaderChg !== null && leaderChg >= 0.01}
                  />
                </>
              )}
            </Section>

            {/* API Server */}
            <Section title="API Server">
              {data.apiserver_5xx_rate.length === 0 && data.apiserver_p99.length === 0 ? (
                <p className="text-gray-400 text-xs italic">API server metrikleri bulunamadı</p>
              ) : (
                <>
                  <StatusRow
                    label="5xx Hata Oranı"
                    value={apiserverErr !== null ? fmtRate(String(apiserverErr)) : "—"}
                    ok={apiserverErr !== null && apiserverErr < 0.01}
                    warn={apiserverErr !== null && apiserverErr >= 0.01}
                  />
                  <StatusRow
                    label={`p99 Latency${worstP99 ? ` (${worstP99[0]})` : ""}`}
                    value={worstP99 ? fmtMs(String(worstP99[1])) : "—"}
                    ok={!!worstP99 && worstP99[1] < 1}
                    warn={!!worstP99 && worstP99[1] >= 1}
                  />
                </>
              )}
            </Section>

            {/* Certificate Expiry */}
            <Section title="Sertifika Süreleri (7 gün içinde dolacaklar)">
              {certExpiry7d === null ? (
                <p className="text-gray-400 text-xs italic">Sertifika metrikleri bulunamadı</p>
              ) : certExpiry7d === 0 ? (
                <p className="text-green-600 text-xs">7 gün içinde dolacak sertifika yok</p>
              ) : (
                <>
                  <div className="text-sm text-red-600 font-semibold mb-2">
                    {certExpiry7d} adet sertifika 7 gün içinde doluyor!
                  </div>
                  {data.cert_expiry_7d.map((m, i) => {
                    const le = parseFloat(m.metric.le ?? "");
                    const cnt = parseFloat(m.value?.[1] ?? "0");
                    if (cnt === 0) return null;
                    return (
                      <div key={i} className="text-xs text-gray-600 py-0.5">
                        {isNaN(le) ? "—" : fmtDays(le)} içinde dolacak: <strong>{cnt}</strong> sertifika
                      </div>
                    );
                  })}
                </>
              )}
            </Section>
          </>
        )}
      </div>
    </div>
  );
}
