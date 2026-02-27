"use client";
import { useState, useEffect, useCallback } from "react";
import {
  getObserveClusters,
  getObserveNamespaces,
  getObservePods,
  getObserveEvents,
  runObservePromQL,
  type ObserveCluster,
  type ObservePod,
  type ObserveEvent,
  type PromQLResult,
} from "@/lib/api";

type Tab = "pods" | "events" | "promql";

// ── Pod Table ─────────────────────────────────────────────────────────────────

function PodTable({
  pods,
  onGoEvents,
}: {
  pods: ObservePod[];
  onGoEvents: (pod: string, ns: string) => void;
}) {
  if (!pods.length) return <p className="text-sm text-gray-400 italic">Pod yok</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-gray-50 text-gray-500 uppercase tracking-wide">
            {["Pod", "Phase", "Ready", "Containers", "Node", "Oluşturma", ""].map((h) => (
              <th key={h} className="px-2 py-1.5 text-left border-b whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {pods.map((p) => {
            const readyCount = p.containers.filter((c) => c.ready).length;
            const totalCount = p.containers.length;
            const allReady = readyCount === totalCount;
            return (
              <tr key={p.name} className="border-b hover:bg-gray-50">
                <td className="px-2 py-1.5 font-mono max-w-[200px] truncate" title={p.name}>
                  {p.name}
                </td>
                <td className="px-2 py-1.5">
                  <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${
                    p.phase === "Running"  ? "bg-green-100 text-green-700" :
                    p.phase === "Pending"  ? "bg-yellow-100 text-yellow-700" :
                                            "bg-red-100 text-red-700"
                  }`}>{p.phase}</span>
                </td>
                <td className={`px-2 py-1.5 font-mono ${allReady ? "text-green-600" : "text-red-600 font-bold"}`}>
                  {readyCount}/{totalCount}
                </td>
                <td className="px-2 py-1.5 text-gray-500 max-w-[200px] truncate">
                  {p.containers.map((c) => c.name).join(", ")}
                </td>
                <td className="px-2 py-1.5 font-mono max-w-[120px] truncate" title={p.node ?? ""}>
                  {p.node || "—"}
                </td>
                <td className="px-2 py-1.5 whitespace-nowrap">
                  {p.created_at ? p.created_at.replace("T", " ").replace("Z", "") : "—"}
                </td>
                <td className="px-2 py-1.5">
                  <button
                    onClick={() => onGoEvents(p.name, p.namespace)}
                    className="text-xs px-2 py-0.5 rounded border text-blue-600 hover:bg-blue-50"
                  >
                    Events
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Event Table ───────────────────────────────────────────────────────────────

function EventTable({ events }: { events: ObserveEvent[] }) {
  if (!events.length) return <p className="text-sm text-gray-400 italic">Event yok</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-gray-50 text-gray-500 uppercase tracking-wide">
            {["Tür", "Reason", "Object", "Mesaj", "Count", "Son Zaman"].map((h) => (
              <th key={h} className="px-2 py-1.5 text-left border-b whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {events.map((e, i) => (
            <tr key={i} className="border-b hover:bg-gray-50">
              <td className="px-2 py-1.5">
                <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${
                  e.type === "Warning" ? "bg-yellow-100 text-yellow-700" : "bg-blue-50 text-blue-600"
                }`}>{e.type}</span>
              </td>
              <td className="px-2 py-1.5 font-mono">{e.reason}</td>
              <td className="px-2 py-1.5 font-mono max-w-[140px] truncate" title={e.object ?? ""}>
                {e.object}
              </td>
              <td className="px-2 py-1.5 max-w-[360px] break-words">{e.message}</td>
              <td className="px-2 py-1.5 text-center">{e.count ?? "—"}</td>
              <td className="px-2 py-1.5 whitespace-nowrap">
                {e.last_time ? e.last_time.replace("T", " ").replace("Z", "") : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── PromQL Panel ──────────────────────────────────────────────────────────────

function PromQLPanel({ cluster }: { cluster: string }) {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<PromQLResult | null>(null);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    if (!query.trim() || !cluster) return;
    setLoading(true);
    try {
      const r = await runObservePromQL(cluster, query.trim());
      setResult(r);
    } finally {
      setLoading(false);
    }
  };

  if (!cluster) return <p className="text-sm text-gray-400 italic">Önce cluster seçin</p>;

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && run()}
          placeholder='ör. kube_pod_status_phase{phase="Failed"}'
          className="flex-1 border rounded px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-300"
        />
        <button
          onClick={run}
          disabled={loading}
          className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "..." : "Çalıştır"}
        </button>
      </div>

      {result && (
        <div>
          {!result.ok ? (
            <p className="text-red-600 text-sm">{result.error}</p>
          ) : result.result.length === 0 ? (
            <p className="text-gray-400 text-sm italic">Sonuç yok</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 uppercase tracking-wide">
                    <th className="px-2 py-1.5 text-left border-b">Metrik</th>
                    <th className="px-2 py-1.5 text-left border-b">Değer</th>
                  </tr>
                </thead>
                <tbody>
                  {result.result.map((r, i) => {
                    const label = Object.entries(r.metric).map(([k, v]) => `${k}="${v}"`).join(", ");
                    const val = r.value ? r.value[1] : "—";
                    return (
                      <tr key={i} className="border-b hover:bg-gray-50">
                        <td className="px-2 py-1.5 font-mono text-gray-600 max-w-[500px] break-all">
                          {`{${label}}`}
                        </td>
                        <td className="px-2 py-1.5 font-semibold">{val}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ObservePage() {
  const [clusters, setClusters]       = useState<ObserveCluster[]>([]);
  const [selCluster, setSelCluster]   = useState("");
  const [tab, setTab]                 = useState<Tab>("pods");

  // shared namespace list
  const [namespaces, setNamespaces]   = useState<string[]>([]);
  const [nsLoading, setNsLoading]     = useState(false);

  // pods tab
  const [selNs, setSelNs]             = useState("");
  const [pods, setPods]               = useState<ObservePod[]>([]);
  const [podsLoading, setPodsLoading] = useState(false);
  const [podsError, setPodsError]     = useState("");

  // events tab
  const [selNsEv, setSelNsEv]         = useState("");
  const [selPodEv, setSelPodEv]       = useState("");
  const [events, setEvents]           = useState<ObserveEvent[]>([]);
  const [evLoading, setEvLoading]     = useState(false);
  const [evError, setEvError]         = useState("");

  useEffect(() => {
    getObserveClusters().catch(() => []).then(setClusters);
  }, []);

  // load namespaces when cluster changes
  useEffect(() => {
    setNamespaces([]);
    setSelNs("");
    setSelNsEv("");
    setPods([]);
    setEvents([]);
    if (!selCluster) return;
    setNsLoading(true);
    getObserveNamespaces(selCluster)
      .catch(() => [])
      .then((ns) => { setNamespaces(ns); setNsLoading(false); });
  }, [selCluster]);

  // load pods
  const loadPods = useCallback(async () => {
    if (!selCluster || !selNs) { setPods([]); return; }
    setPodsLoading(true);
    setPodsError("");
    try {
      setPods(await getObservePods(selCluster, selNs));
    } catch (e: unknown) {
      setPodsError(String(e));
      setPods([]);
    } finally {
      setPodsLoading(false);
    }
  }, [selCluster, selNs]);

  useEffect(() => { loadPods(); }, [loadPods]);

  // load events
  const loadEvents = useCallback(async () => {
    if (!selCluster || !selNsEv) { setEvents([]); return; }
    setEvLoading(true);
    setEvError("");
    try {
      setEvents(await getObserveEvents(selCluster, selNsEv, selPodEv || undefined));
    } catch (e: unknown) {
      setEvError(String(e));
      setEvents([]);
    } finally {
      setEvLoading(false);
    }
  }, [selCluster, selNsEv, selPodEv]);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  const currentCluster = clusters.find((c) => c.name === selCluster);

  function goToEvents(pod: string, ns: string) {
    setSelNsEv(ns);
    setSelPodEv(pod);
    setTab("events");
  }

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-gray-800">Observe</h1>

      {/* Cluster selector */}
      <div className="bg-white border rounded-lg shadow-sm p-4 flex items-center gap-4 flex-wrap">
        <label className="text-sm text-gray-600 font-medium">Cluster</label>
        <select
          value={selCluster}
          onChange={(e) => setSelCluster(e.target.value)}
          className="border rounded px-3 py-1.5 text-sm w-56"
        >
          <option value="">— Seç —</option>
          {clusters.map((c) => (
            <option key={c.name} value={c.name}>{c.name}</option>
          ))}
        </select>

        {currentCluster && (
          <div className="flex gap-2 text-xs">
            <span className={`px-2 py-0.5 rounded-full font-medium ${
              currentCluster.prometheus_available
                ? "bg-green-100 text-green-700"
                : "bg-gray-100 text-gray-400"
            }`}>Prometheus {currentCluster.prometheus_available ? "✓" : "—"}</span>
            <span className={`px-2 py-0.5 rounded-full font-medium ${
              currentCluster.loki_available
                ? "bg-green-100 text-green-700"
                : "bg-gray-100 text-gray-400"
            }`}>Loki {currentCluster.loki_available ? "✓" : "—"}</span>
          </div>
        )}

        {nsLoading && <span className="text-xs text-gray-400">Namespace'ler yükleniyor...</span>}
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {(["pods", "events", "promql"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === t
                ? "bg-blue-600 text-white"
                : "bg-white border text-gray-600 hover:bg-gray-50"
            }`}
          >
            {t === "pods" ? "Pods" : t === "events" ? "Events" : "PromQL"}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="bg-white border rounded-lg shadow-sm p-5">
        {/* ── Pods ── */}
        {tab === "pods" && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <label className="text-sm text-gray-600 font-medium">Namespace</label>
              <select
                value={selNs}
                onChange={(e) => setSelNs(e.target.value)}
                className="border rounded px-3 py-1.5 text-sm w-56"
                disabled={!selCluster || nsLoading}
              >
                <option value="">— Seç —</option>
                {namespaces.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
              {selNs && (
                <button onClick={loadPods} className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50">
                  ↻
                </button>
              )}
            </div>
            {podsError && <p className="text-red-600 text-sm">{podsError}</p>}
            {podsLoading ? (
              <p className="text-gray-400 text-sm">Yükleniyor...</p>
            ) : (
              <PodTable pods={pods} onGoEvents={goToEvents} />
            )}
          </div>
        )}

        {/* ── Events ── */}
        {tab === "events" && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600 font-medium">Namespace</label>
                <select
                  value={selNsEv}
                  onChange={(e) => { setSelNsEv(e.target.value); setSelPodEv(""); }}
                  className="border rounded px-3 py-1.5 text-sm w-48"
                  disabled={!selCluster || nsLoading}
                >
                  <option value="">— Seç —</option>
                  {namespaces.map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600 font-medium">Pod</label>
                <input
                  value={selPodEv}
                  onChange={(e) => setSelPodEv(e.target.value)}
                  placeholder="opsiyonel"
                  className="border rounded px-3 py-1.5 text-sm font-mono w-48"
                />
              </div>
              {selNsEv && (
                <button onClick={loadEvents} className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50">
                  ↻
                </button>
              )}
            </div>
            {evError && <p className="text-red-600 text-sm">{evError}</p>}
            {evLoading ? (
              <p className="text-gray-400 text-sm">Yükleniyor...</p>
            ) : (
              <EventTable events={events} />
            )}
          </div>
        )}

        {/* ── PromQL ── */}
        {tab === "promql" && <PromQLPanel cluster={selCluster} />}
      </div>
    </div>
  );
}
