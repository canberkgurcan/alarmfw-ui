"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import {
  getObserveAuth,
  getObserveClusters,
  getObserveNamespaces,
  getObservePods,
  getObserveEvents,
  runObservePromQL,
  getObserveNamespaceSummary,
  getObservePodMetrics,
  type ObserveAuth,
  type ObserveCluster,
  type ObservePod,
  type ObserveEvent,
  type PromQLResult,
  type NamespaceSummary,
} from "@/lib/api";

import PanelOverview     from "./PanelOverview";
import PanelAlerts       from "./PanelAlerts";
import PanelNodes        from "./PanelNodes";
import PanelWorkload     from "./PanelWorkload";
import PanelCapacity     from "./PanelCapacity";
import PanelControlPlane from "./PanelControlPlane";

type Tab = "overview" | "alerts" | "nodes" | "workload" | "capacity" | "controlplane" | "pods" | "events" | "promql";

const QUICK_QUERIES = [
  { label: "Top 10 CPU kullanan pod",    query: 'topk(10, sum(rate(container_cpu_usage_seconds_total{container!="",container!="POD"}[5m])) by (pod, namespace))' },
  { label: "Top 10 Memory kullanan pod", query: 'topk(10, sum(container_memory_working_set_bytes{container!="",container!="POD"}) by (pod, namespace))' },
  { label: "Restart > 5 containerlar",  query: "kube_pod_container_status_restarts_total > 5" },
  { label: "Failed pod'lar",            query: 'kube_pod_status_phase{phase="Failed"} == 1' },
  { label: "Node CPU kullanımı (%)",    query: '100 - (avg by (node) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)' },
  { label: "Firing alertler",           query: 'ALERTS{alertstate="firing"}' },
];

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtCpu(val: string): string {
  const v = parseFloat(val);
  if (isNaN(v)) return "—";
  if (v < 0.001) return `${(v * 1_000_000).toFixed(0)}μ`;
  if (v < 1)     return `${(v * 1000).toFixed(1)}m`;
  return `${v.toFixed(3)}c`;
}

function fmtMem(val: string): string {
  const v = parseFloat(val);
  if (isNaN(v)) return "—";
  if (v >= 1_073_741_824) return `${(v / 1_073_741_824).toFixed(1)} GiB`;
  if (v >= 1_048_576)     return `${(v / 1_048_576).toFixed(0)} MiB`;
  return `${(v / 1024).toFixed(0)} KiB`;
}

// ── Pod Drawer ─────────────────────────────────────────────────────────────────

function PodDrawer({ pod, cluster, onClose }: { pod: ObservePod; cluster: string; onClose: () => void }) {
  const [metrics, setMetrics] = useState<{ cpu: PromQLResult; memory: PromQLResult } | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [events, setEvents]   = useState<ObserveEvent[]>([]);
  const [evLoading, setEvLoading] = useState(false);

  useEffect(() => {
    setMetricsLoading(true);
    getObservePodMetrics(pod.name, pod.namespace, cluster)
      .then(setMetrics).catch(() => {}).finally(() => setMetricsLoading(false));
    setEvLoading(true);
    getObserveEvents(cluster, pod.namespace, pod.name)
      .then(setEvents).catch(() => {}).finally(() => setEvLoading(false));
  }, [pod.name, pod.namespace, cluster]);

  const cpuMap: Record<string, string> = {};
  const memMap: Record<string, string> = {};
  if (metrics?.cpu?.ok)    for (const r of metrics.cpu.result)    { const c = r.metric.container; if (c && r.value) cpuMap[c] = r.value[1]; }
  if (metrics?.memory?.ok) for (const r of metrics.memory.result) { const c = r.metric.container; if (c && r.value) memMap[c] = r.value[1]; }

  const totalRestarts = pod.containers.reduce((a, c) => a + c.restarts, 0);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="flex-1 bg-black/20" onClick={onClose} />
      <div className="w-[480px] bg-white shadow-xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b bg-gray-50 shrink-0">
          <div className="min-w-0">
            <div className="font-mono text-sm font-semibold text-gray-800 truncate" title={pod.name}>{pod.name}</div>
            <div className="text-xs text-gray-500 mt-0.5">{pod.namespace} · {pod.node || "—"}</div>
          </div>
          <button onClick={onClose} className="ml-3 shrink-0 text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <div className="flex gap-2 flex-wrap text-xs">
            <span className={`px-2 py-1 rounded-full font-semibold ${pod.phase === "Running" ? "bg-green-100 text-green-700" : pod.phase === "Pending" ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}`}>{pod.phase}</span>
            {totalRestarts > 0 && (
              <span className={`px-2 py-1 rounded-full font-semibold ${totalRestarts >= 10 ? "bg-red-100 text-red-700" : "bg-orange-100 text-orange-700"}`}>↻ {totalRestarts} restart</span>
            )}
            {pod.created_at && (
              <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-500">{pod.created_at.replace("T", " ").replace("Z", "")}</span>
            )}
          </div>
          <div>
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Containers</div>
            <div className="space-y-1">
              {pod.containers.map((c) => (
                <div key={c.name} className="flex items-center gap-2 bg-gray-50 rounded px-3 py-2 text-xs">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${c.ready ? "bg-green-500" : "bg-red-500"}`} />
                  <span className="font-mono font-medium text-gray-700 flex-1 truncate min-w-0" title={c.name}>{c.name}</span>
                  {metricsLoading ? <span className="text-gray-300">...</span> : (
                    <>
                      {cpuMap[c.name] && <span className="text-gray-500 shrink-0">CPU {fmtCpu(cpuMap[c.name])}</span>}
                      {memMap[c.name] && <span className="text-gray-500 shrink-0">{fmtMem(memMap[c.name])}</span>}
                    </>
                  )}
                  {c.restarts > 0 && (
                    <span className={`shrink-0 px-1.5 py-0.5 rounded font-semibold ${c.restarts >= 10 ? "bg-red-100 text-red-700" : "bg-orange-100 text-orange-700"}`}>↻{c.restarts}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Son Events</div>
            {evLoading ? <p className="text-xs text-gray-400">Yükleniyor...</p> : events.length === 0 ? (
              <p className="text-xs text-gray-400 italic">Event yok</p>
            ) : (
              <div className="space-y-1 max-h-52 overflow-y-auto">
                {events.slice(0, 12).map((e, i) => (
                  <div key={i} className={`flex gap-2 text-xs rounded px-2 py-1.5 ${e.type === "Warning" ? "bg-yellow-50" : "bg-gray-50"}`}>
                    <span className={`shrink-0 font-semibold ${e.type === "Warning" ? "text-yellow-700" : "text-blue-600"}`}>{e.reason}</span>
                    <span className="text-gray-600 flex-1 break-words">{e.message}</span>
                    {e.count && e.count > 1 && <span className="shrink-0 text-gray-400">×{e.count}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Pod Table ─────────────────────────────────────────────────────────────────

function PodTable({ pods, onGoEvents, onSelect }: { pods: ObservePod[]; onGoEvents: (pod: string, ns: string) => void; onSelect: (pod: ObservePod) => void }) {
  if (!pods.length) return <p className="text-sm text-gray-400 italic p-4">Pod yok</p>;
  return (
    <table className="w-full text-xs border-collapse">
      <thead className="sticky top-0 z-10 bg-gray-50">
        <tr className="text-gray-500 uppercase tracking-wide">
          {["Pod", "Phase", "Ready", "Restarts", "Containers", "Node", "Oluşturma", ""].map((h) => (
            <th key={h} className="px-3 py-2 text-left border-b whitespace-nowrap">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {pods.map((p) => {
          const readyCount    = p.containers.filter((c) => c.ready).length;
          const totalCount    = p.containers.length;
          const allReady      = readyCount === totalCount;
          const totalRestarts = p.containers.reduce((a, c) => a + c.restarts, 0);
          return (
            <tr key={p.name} className="border-b hover:bg-blue-50 cursor-pointer" onClick={() => onSelect(p)}>
              <td className="px-3 py-1.5 font-mono max-w-[200px] truncate" title={p.name}>{p.name}</td>
              <td className="px-3 py-1.5">
                <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${p.phase === "Running" ? "bg-green-100 text-green-700" : p.phase === "Pending" ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}`}>{p.phase}</span>
              </td>
              <td className={`px-3 py-1.5 font-mono ${allReady ? "text-green-600" : "text-red-600 font-bold"}`}>{readyCount}/{totalCount}</td>
              <td className={`px-3 py-1.5 font-mono font-semibold ${totalRestarts === 0 ? "text-gray-300" : totalRestarts >= 10 ? "text-red-600" : "text-orange-600"}`}>
                {totalRestarts > 0 ? `↻ ${totalRestarts}` : "—"}
              </td>
              <td className="px-3 py-1.5 text-gray-500 max-w-[200px] truncate">{p.containers.map((c) => c.name).join(", ")}</td>
              <td className="px-3 py-1.5 font-mono max-w-[120px] truncate" title={p.node ?? ""}>{p.node || "—"}</td>
              <td className="px-3 py-1.5 whitespace-nowrap">{p.created_at ? p.created_at.replace("T", " ").replace("Z", "") : "—"}</td>
              <td className="px-3 py-1.5" onClick={(e) => { e.stopPropagation(); onGoEvents(p.name, p.namespace); }}>
                <button className="text-xs px-2 py-0.5 rounded border text-blue-600 hover:bg-blue-50">Events</button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// ── Event Table ───────────────────────────────────────────────────────────────

function EventTable({ events }: { events: ObserveEvent[] }) {
  if (!events.length) return <p className="text-sm text-gray-400 italic p-4">Event yok</p>;
  return (
    <table className="w-full text-xs border-collapse">
      <thead className="sticky top-0 z-10 bg-gray-50">
        <tr className="text-gray-500 uppercase tracking-wide">
          {["Tür", "Reason", "Object", "Mesaj", "Count", "Son Zaman"].map((h) => (
            <th key={h} className="px-3 py-2 text-left border-b whitespace-nowrap">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {events.map((e, i) => (
          <tr key={i} className="border-b hover:bg-gray-50">
            <td className="px-3 py-1.5">
              <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${e.type === "Warning" ? "bg-yellow-100 text-yellow-700" : "bg-blue-50 text-blue-600"}`}>{e.type}</span>
            </td>
            <td className="px-3 py-1.5 font-mono">{e.reason}</td>
            <td className="px-3 py-1.5 font-mono max-w-[140px] truncate" title={e.object ?? ""}>{e.object}</td>
            <td className="px-3 py-1.5 max-w-[360px] break-words">{e.message}</td>
            <td className="px-3 py-1.5 text-center">{e.count ?? "—"}</td>
            <td className="px-3 py-1.5 whitespace-nowrap">{e.last_time ? e.last_time.replace("T", " ").replace("Z", "") : "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── PromQL Panel ──────────────────────────────────────────────────────────────

function PromQLPanel({ cluster }: { cluster: string }) {
  const [query, setQuery]   = useState("");
  const [result, setResult] = useState<PromQLResult | null>(null);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      setResult(await runObservePromQL(cluster, query.trim()));
    } finally { setLoading(false); }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex gap-2 px-5 py-3 border-b shrink-0 flex-wrap items-center">
        <select className="border rounded px-2 py-1.5 text-sm text-gray-600 bg-white" value="" onChange={(e) => { if (e.target.value) setQuery(e.target.value); }}>
          <option value="">Hazır sorgular</option>
          {QUICK_QUERIES.map((q) => <option key={q.label} value={q.query}>{q.label}</option>)}
        </select>
        <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && run()}
          placeholder='ör. kube_pod_status_phase{phase="Failed"}'
          className="flex-1 min-w-[200px] border rounded px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-300" />
        <button onClick={run} disabled={loading} className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50">
          {loading ? "..." : "Çalıştır"}
        </button>
      </div>
      <div className="flex-1 min-h-0 overflow-auto">
        {result && (
          !result.ok ? <p className="text-red-600 text-sm p-4">{result.error}</p> :
          result.result.length === 0 ? <p className="text-gray-400 text-sm italic p-4">Sonuç yok</p> : (
            <table className="w-full text-xs border-collapse">
              <thead className="sticky top-0 z-10 bg-gray-50">
                <tr className="text-gray-500 uppercase tracking-wide">
                  <th className="px-3 py-2 text-left border-b">Metrik</th>
                  <th className="px-3 py-2 text-left border-b">Değer</th>
                </tr>
              </thead>
              <tbody>
                {result.result.map((r, i) => (
                  <tr key={i} className="border-b hover:bg-gray-50">
                    <td className="px-3 py-1.5 font-mono text-gray-600 max-w-[500px] break-all">{`{${Object.entries(r.metric).map(([k, v]) => `${k}="${v}"`).join(", ")}}`}</td>
                    <td className="px-3 py-1.5 font-semibold">{r.value ? r.value[1] : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}
      </div>
    </div>
  );
}

// ── No Token Screen ───────────────────────────────────────────────────────────

function NoTokenScreen({ hasPromUrl }: { hasPromUrl: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center space-y-4">
      <div className="text-5xl">🔑</div>
      <h2 className="text-xl font-semibold text-gray-700">Prometheus token bulunamadı</h2>
      {!hasPromUrl && (
        <p className="text-sm text-orange-600 max-w-sm">
          Ayrıca Prometheus URL tanımlanmamış —{" "}
          <code className="bg-gray-100 px-1 rounded">observe.yaml</code> dosyasında cluster yapılandırın.
        </p>
      )}
      <p className="text-sm text-gray-500 max-w-sm">
        <a href="/secrets" className="text-blue-600 hover:underline font-medium">Secrets sayfasına</a> giderek{" "}
        <code className="bg-gray-100 px-1 rounded">prometheus.token</code> dosyasını ekleyin.
      </p>
    </div>
  );
}

// ── Tab config ────────────────────────────────────────────────────────────────

const TAB_LABELS: Record<Tab, string> = {
  overview:     "Overview",
  alerts:       "Alertler",
  nodes:        "Nodes",
  workload:     "Workload",
  capacity:     "Kapasite",
  controlplane: "Kontrol Düzlemi",
  pods:         "Pods",
  events:       "Events",
  promql:       "PromQL",
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ObservePage() {
  const [auth, setAuth]             = useState<ObserveAuth | null>(null);
  const [clusters, setClusters]     = useState<ObserveCluster[]>([]);
  const [selCluster, setSelCluster] = useState("");
  const [tab, setTab]               = useState<Tab>("overview");

  const [nsMap, setNsMap]         = useState<Record<string, string[]>>({});
  const [nsLoading, setNsLoading] = useState(false);

  // pods tab
  const [selNs, setSelNs]             = useState("");
  const [pods, setPods]               = useState<ObservePod[]>([]);
  const [podsLoading, setPodsLoading] = useState(false);
  const [podsError, setPodsError]     = useState("");
  const [nsSummary, setNsSummary]     = useState<NamespaceSummary | null>(null);
  const [selectedPod, setSelectedPod] = useState<ObservePod | null>(null);

  // events tab
  const [selNsEv, setSelNsEv]   = useState("");
  const [selPodEv, setSelPodEv] = useState("");
  const [events, setEvents]     = useState<ObserveEvent[]>([]);
  const [evLoading, setEvLoading] = useState(false);
  const [evError, setEvError]     = useState("");

  const prevAuthRef = useRef<boolean | null>(null);

  // ── Auth polling (5 sn) ────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    async function checkAuth() {
      try {
        const a = await getObserveAuth();
        if (cancelled) return;
        if (prevAuthRef.current === true && !a.logged_in) {
          setClusters([]); setNsMap({}); setSelCluster(""); setPods([]); setEvents([]);
        }
        if (prevAuthRef.current === false && a.logged_in) loadClustersAndNamespaces();
        prevAuthRef.current = a.logged_in;
        setAuth(a);
      } catch { /* observe servisine erişilemiyor */ }
    }
    checkAuth();
    const interval = setInterval(checkAuth, 5000);
    return () => { cancelled = true; clearInterval(interval); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Cluster + namespace yükleme ────────────────────────────────────────────
  const loadClustersAndNamespaces = useCallback(async () => {
    try {
      const cs = await getObserveClusters();
      setClusters(cs);
      setNsLoading(true);
      const results = await Promise.allSettled(
        cs.map((c) => getObserveNamespaces(c.name).then((ns) => ({ name: c.name, ns })))
      );
      const map: Record<string, string[]> = {};
      for (const r of results) {
        if (r.status === "fulfilled") map[r.value.name] = r.value.ns;
      }
      setNsMap(map);
    } catch { /* hata yoksay */ }
    finally { setNsLoading(false); }
  }, []);

  useEffect(() => { if (auth?.logged_in) loadClustersAndNamespaces(); }, [auth?.logged_in, loadClustersAndNamespaces]);
  useEffect(() => { setSelNs(""); setSelNsEv(""); setPods([]); setEvents([]); setNsSummary(null); }, [selCluster]);

  // ── Namespace summary ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!selCluster || !selNs) { setNsSummary(null); return; }
    getObserveNamespaceSummary(selCluster, selNs).then(setNsSummary).catch(() => setNsSummary(null));
  }, [selCluster, selNs]);

  // ── Pod yükleme ────────────────────────────────────────────────────────────
  const loadPods = useCallback(async () => {
    if (!selCluster || !selNs) { setPods([]); return; }
    setPodsLoading(true); setPodsError("");
    try { setPods(await getObservePods(selCluster, selNs)); }
    catch (e: unknown) { setPodsError(String(e)); setPods([]); }
    finally { setPodsLoading(false); }
  }, [selCluster, selNs]);

  useEffect(() => { loadPods(); }, [loadPods]);

  // ── Event yükleme ──────────────────────────────────────────────────────────
  const loadEvents = useCallback(async () => {
    if (!selCluster || !selNsEv) { setEvents([]); return; }
    setEvLoading(true); setEvError("");
    try { setEvents(await getObserveEvents(selCluster, selNsEv, selPodEv || undefined)); }
    catch (e: unknown) { setEvError(String(e)); setEvents([]); }
    finally { setEvLoading(false); }
  }, [selCluster, selNsEv, selPodEv]);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  const refreshNamespaces = useCallback(async (cluster: string) => {
    if (!cluster) return;
    try {
      const ns = await getObserveNamespaces(cluster);
      setNsMap((prev) => ({ ...prev, [cluster]: ns }));
    } catch { /* yoksay */ }
  }, []);

  function goToEvents(pod: string, ns: string) {
    setSelNsEv(ns); setSelPodEv(pod); setTab("events");
  }

  if (auth === null) {
    return <div className="flex items-center justify-center py-24 text-gray-400 text-sm">Bağlanıyor...</div>;
  }
  if (!auth.logged_in) {
    return <NoTokenScreen hasPromUrl={auth.has_prom_url} />;
  }

  const namespaces     = nsMap[selCluster] ?? [];
  const currentCluster = clusters.find((c) => c.name === selCluster);
  const ALL_TABS: Tab[] = ["overview", "alerts", "nodes", "workload", "capacity", "controlplane", "pods", "events", "promql"];

  return (
    <>
      {selectedPod && <PodDrawer pod={selectedPod} cluster={selCluster} onClose={() => setSelectedPod(null)} />}

      <div className="flex flex-col flex-1 min-h-0 gap-3">
        {/* ── Üst bölüm ──────────────────────────────────────────────────── */}
        <div className="shrink-0 space-y-3">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-gray-800">Observe</h1>
            <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700 font-medium">Bağlı</span>
          </div>

          {/* Cluster selector */}
          <div className="bg-white border rounded-lg shadow-sm p-4 flex items-center gap-4 flex-wrap">
            <label className="text-sm text-gray-600 font-medium">Cluster</label>
            <select value={selCluster} onChange={(e) => setSelCluster(e.target.value)} className="border rounded px-3 py-1.5 text-sm w-56">
              <option value="">— Seç —</option>
              {clusters.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
            </select>

            {currentCluster && (
              <div className="flex gap-2 text-xs">
                <span className={`px-2 py-0.5 rounded-full font-medium ${currentCluster.prometheus_available ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"}`}>
                  Prometheus {currentCluster.prometheus_available ? "✓" : "—"}
                </span>
                <span className={`px-2 py-0.5 rounded-full font-medium ${currentCluster.loki_available ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"}`}>
                  Loki {currentCluster.loki_available ? "✓" : "—"}
                </span>
              </div>
            )}

            {nsLoading && <span className="text-xs text-gray-400 animate-pulse">Namespace&apos;ler yükleniyor...</span>}
            {selCluster && !nsLoading && (
              <button onClick={() => refreshNamespaces(selCluster)} className="text-xs px-2 py-1 border rounded hover:bg-gray-50 text-gray-500" title="Namespace listesini yenile">↻ NS</button>
            )}
          </div>

          {/* Tabs — scrollable on small screens */}
          <div className="flex gap-1.5 overflow-x-auto pb-0.5">
            {ALL_TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors shrink-0 ${
                  tab === t ? "bg-blue-600 text-white" : "bg-white border text-gray-600 hover:bg-gray-50"
                }`}
              >
                {TAB_LABELS[t]}
              </button>
            ))}
          </div>
        </div>

        {/* ── Tab content ───────────────────────────────────────────────── */}
        <div className="flex-1 min-h-0 bg-white border rounded-lg shadow-sm flex flex-col overflow-hidden">

          {tab === "overview"     && <PanelOverview     cluster={selCluster} onNavigate={(t) => setTab(t as Tab)} />}
          {tab === "alerts"       && <PanelAlerts        cluster={selCluster} />}
          {tab === "nodes"        && <PanelNodes         cluster={selCluster} />}
          {tab === "workload"     && <PanelWorkload      cluster={selCluster} />}
          {tab === "capacity"     && <PanelCapacity      cluster={selCluster} />}
          {tab === "controlplane" && <PanelControlPlane  cluster={selCluster} />}
          {tab === "promql"       && <PromQLPanel         cluster={selCluster} />}

          {/* ── Pods ── */}
          {tab === "pods" && (
            <>
              <div className="px-5 py-3 border-b shrink-0 flex flex-col gap-2">
                <div className="flex items-center gap-3 flex-wrap">
                  <label className="text-sm text-gray-600 font-medium">Namespace</label>
                  <select value={selNs} onChange={(e) => setSelNs(e.target.value)} className="border rounded px-3 py-1.5 text-sm w-56" disabled={!selCluster}>
                    <option value="">— Seç —</option>
                    {namespaces.map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                  {selNs && <button onClick={loadPods} className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50">↻</button>}
                  {podsError && <span className="text-red-600 text-sm">{podsError}</span>}
                </div>
                {selNs && nsSummary && (
                  <div className="flex flex-wrap gap-1.5">
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Running {nsSummary.running}</span>
                    {nsSummary.failed > 0 && <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">Failed {nsSummary.failed}</span>}
                    {nsSummary.pending > 0 && <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">Pending {nsSummary.pending}</span>}
                    {nsSummary.total_restarts > 0 && (
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${nsSummary.total_restarts >= 10 ? "bg-red-100 text-red-700" : "bg-orange-100 text-orange-700"}`}>↻ {nsSummary.total_restarts} restart</span>
                    )}
                    {nsSummary.warning_events > 0 && <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">⚠ {nsSummary.warning_events} warning event</span>}
                  </div>
                )}
              </div>
              <div className="flex-1 min-h-0 overflow-auto">
                {podsLoading ? <p className="text-gray-400 text-sm p-4">Yükleniyor...</p> : <PodTable pods={pods} onGoEvents={goToEvents} onSelect={setSelectedPod} />}
              </div>
            </>
          )}

          {/* ── Events ── */}
          {tab === "events" && (
            <>
              <div className="px-5 py-3 border-b shrink-0 flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-600 font-medium">Namespace</label>
                  <select value={selNsEv} onChange={(e) => { setSelNsEv(e.target.value); setSelPodEv(""); }} className="border rounded px-3 py-1.5 text-sm w-48" disabled={!selCluster}>
                    <option value="">— Seç —</option>
                    {namespaces.map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-600 font-medium">Pod</label>
                  <input value={selPodEv} onChange={(e) => setSelPodEv(e.target.value)} placeholder="opsiyonel" className="border rounded px-3 py-1.5 text-sm font-mono w-48" />
                </div>
                {selNsEv && <button onClick={loadEvents} className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50">↻</button>}
                {evError && <span className="text-red-600 text-sm">{evError}</span>}
              </div>
              <div className="flex-1 min-h-0 overflow-auto">
                {evLoading ? <p className="text-gray-400 text-sm p-4">Yükleniyor...</p> : <EventTable events={events} />}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
