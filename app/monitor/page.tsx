"use client";

import { useEffect, useState, useCallback } from "react";
import {
  getMonitorPods,
  getMonitorNamespaces,
  getMonitorClusters,
  getObservePods,
  getObservePodLogs,
  getObserveEvents,
  triggerRun,
  getLastRun,
  MonitorSnapshot,
  PodInfo,
  ObserveEvent,
} from "@/lib/api";

// pod adı → güncel restart sayısı
type LiveRestarts = Record<string, number>;

// ── PodDetailModal ────────────────────────────────────────────────────────────

interface ModalState {
  type: "logs" | "events";
  pod: string;
  cluster: string;
  namespace: string;
}

function downloadTxt(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function PodDetailModal({
  modal,
  onClose,
}: {
  modal: ModalState;
  onClose: () => void;
}) {
  const [content, setContent] = useState<string | null>(null);
  const [events, setEvents] = useState<ObserveEvent[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setContent(null);
    setEvents(null);

    if (modal.type === "logs") {
      getObservePodLogs(modal.cluster, modal.namespace, modal.pod)
        .then((r) => { if (!cancelled) setContent(r.logs); })
        .catch((e) => { if (!cancelled) setError(String(e)); })
        .finally(() => { if (!cancelled) setLoading(false); });
    } else {
      getObserveEvents(modal.cluster, modal.namespace, modal.pod)
        .then((r) => { if (!cancelled) setEvents(r); })
        .catch((e) => { if (!cancelled) setError(String(e)); })
        .finally(() => { if (!cancelled) setLoading(false); });
    }

    return () => { cancelled = true; };
  }, [modal]);

  const handleDownload = () => {
    const filename = `${modal.pod}-${modal.type}.txt`;
    if (modal.type === "logs" && content !== null) {
      downloadTxt(filename, content);
    } else if (modal.type === "events" && events !== null) {
      const lines = events.map((e) =>
        [e.last_time, e.type, e.reason, e.message].filter(Boolean).join("\t")
      );
      downloadTxt(filename, lines.join("\n"));
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-lg shadow-xl w-[800px] max-w-[95vw] max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <div>
            <span className="font-semibold text-sm capitalize">{modal.type}</span>
            <span className="text-gray-400 mx-2">—</span>
            <span className="font-mono text-sm text-gray-700">{modal.pod}</span>
          </div>
          <div className="flex items-center gap-2">
            {(content !== null || events !== null) && (
              <button
                onClick={handleDownload}
                className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded border text-gray-700"
              >
                ↓ TXT indir
              </button>
            )}
            <button
              onClick={onClose}
              className="px-3 py-1 text-xs bg-red-50 hover:bg-red-100 rounded border text-red-600"
            >
              Kapat
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto p-4">
          {loading && <p className="text-sm text-gray-400">Yükleniyor...</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}

          {modal.type === "logs" && content !== null && (
            <pre className="text-xs font-mono whitespace-pre-wrap text-gray-800 leading-relaxed">
              {content || "(log yok)"}
            </pre>
          )}

          {modal.type === "events" && events !== null && (
            events.length === 0 ? (
              <p className="text-sm text-gray-400 italic">Event bulunamadı.</p>
            ) : (
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 uppercase tracking-wide">
                    {["Zaman", "Tür", "Reason", "Mesaj", "Sayı"].map((h) => (
                      <th key={h} className="px-2 py-1.5 text-left border-b whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {events.map((ev, i) => (
                    <tr key={i} className={`border-b ${ev.type === "Warning" ? "bg-orange-50" : ""}`}>
                      <td className="px-2 py-1.5 whitespace-nowrap text-gray-500">{ev.last_time ? new Date(ev.last_time).toLocaleString("tr-TR") : "—"}</td>
                      <td className="px-2 py-1.5">
                        <span className={`font-semibold ${ev.type === "Warning" ? "text-orange-600" : "text-blue-600"}`}>{ev.type}</span>
                      </td>
                      <td className="px-2 py-1.5 font-mono">{ev.reason}</td>
                      <td className="px-2 py-1.5 max-w-[360px]">{ev.message}</td>
                      <td className="px-2 py-1.5 text-center">{ev.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}
        </div>
      </div>
    </div>
  );
}

// ── helpers ──────────────────────────────────────────────────────────────────

function statusBadge(status: string) {
  const cls =
    status === "PROBLEM"
      ? "bg-red-100 text-red-700"
      : status === "OK"
      ? "bg-green-100 text-green-700"
      : "bg-yellow-100 text-yellow-700";
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${cls}`}>
      {status}
    </span>
  );
}

function readyBadge(ready_str: string) {
  const [ready, total] = ready_str.split("/").map(Number);
  const ok = ready === total;
  return (
    <span className={`font-mono text-sm ${ok ? "text-green-600" : "text-red-600 font-bold"}`}>
      {ready_str}
    </span>
  );
}

function ts(utc: string) {
  try {
    return new Date(utc).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" });
  } catch {
    return utc;
  }
}

// ── PodTable ─────────────────────────────────────────────────────────────────

function PodTable({
  pods,
  liveRestarts,
  onOpen,
}: {
  pods: PodInfo[];
  liveRestarts: LiveRestarts;
  onOpen: (type: "logs" | "events", pod: string) => void;
}) {
  if (!pods.length)
    return <p className="text-sm text-gray-400 italic">Pod yok</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-gray-50 text-gray-500 uppercase tracking-wide">
            {["Pod", "Ready", "Restarts", "Phase", "Waiting / Terminated", "Node", "Workload", "Image", "Oluşturma", ""].map(
              (h) => (
                <th key={h} className="px-2 py-1.5 text-left border-b whitespace-nowrap">
                  {h}
                </th>
              )
            )}
          </tr>
        </thead>
        <tbody>
          {pods.map((p) => {
            const live = liveRestarts[p.pod];
            const hasLive = live !== undefined;
            return (
              <tr key={p.pod} className="border-b hover:bg-gray-50">
                <td className="px-2 py-1.5 font-mono max-w-[180px] truncate" title={p.pod}>
                  {p.pod}
                </td>
                <td className="px-2 py-1.5">{readyBadge(p.ready_str)}</td>
                <td className="px-2 py-1.5 text-center">
                  {hasLive ? (
                    <span className="flex items-center justify-center gap-1">
                      <span className={`font-semibold ${live > p.restarts ? "text-red-600" : ""}`}>{live}</span>
                      <span className="text-green-500 text-[10px]" title="Canlı veri">●</span>
                    </span>
                  ) : (
                    p.restarts
                  )}
                </td>
                <td className="px-2 py-1.5">{p.phase}</td>
                <td className="px-2 py-1.5 text-orange-600">
                  {[p.waiting, p.terminated].filter(Boolean).join(" / ") || "—"}
                </td>
                <td className="px-2 py-1.5 font-mono max-w-[120px] truncate" title={p.node}>
                  {p.node || "—"}
                </td>
                <td className="px-2 py-1.5 max-w-[140px] truncate" title={p.workload}>
                  {p.workload || "—"}
                </td>
                <td className="px-2 py-1.5 font-mono max-w-[100px] truncate" title={p.image}>
                  {p.image || "—"}
                </td>
                <td className="px-2 py-1.5 whitespace-nowrap">{p.created_at || "—"}</td>
                <td className="px-2 py-1.5 whitespace-nowrap">
                  <div className="flex gap-1">
                    <button
                      onClick={() => onOpen("logs", p.pod)}
                      className="px-2 py-0.5 text-[10px] font-medium rounded border border-gray-300 hover:bg-blue-50 hover:border-blue-400 hover:text-blue-700 transition-colors"
                    >
                      Log
                    </button>
                    <button
                      onClick={() => onOpen("events", p.pod)}
                      className="px-2 py-0.5 text-[10px] font-medium rounded border border-gray-300 hover:bg-orange-50 hover:border-orange-400 hover:text-orange-700 transition-colors"
                    >
                      Event
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── SnapshotCard ──────────────────────────────────────────────────────────────

function SnapshotCard({ snap }: { snap: MonitorSnapshot }) {
  const [open, setOpen] = useState(true);
  const [liveRestarts, setLiveRestarts] = useState<LiveRestarts>({});
  const [modal, setModal] = useState<ModalState | null>(null);

  useEffect(() => {
    getObservePods(snap.cluster, snap.namespace)
      .then((pods) => {
        const map: LiveRestarts = {};
        pods.forEach((p) => {
          map[p.name] = p.containers.reduce((s, c) => s + c.restarts, 0);
        });
        setLiveRestarts(map);
      })
      .catch(() => {});
  }, [snap.cluster, snap.namespace]);

  const handleOpen = (type: "logs" | "events", pod: string) => {
    setModal({ type, pod, cluster: snap.cluster, namespace: snap.namespace });
  };

  return (
    <>
      {modal && <PodDetailModal modal={modal} onClose={() => setModal(null)} />}
      <div className="border rounded-lg bg-white shadow-sm mb-3">
        <button
          onClick={() => setOpen((o) => !o)}
          className="w-full flex items-center justify-between px-4 py-3 text-left"
        >
          <div className="flex items-center gap-3">
            {statusBadge(snap.status)}
            <span className="font-semibold text-sm">{snap.namespace}</span>
            <span className="text-gray-400 text-sm">@</span>
            <span className="text-blue-600 text-sm font-mono">{snap.cluster}</span>
            <span className="text-gray-400 text-xs ml-2">{snap.pods.length} pod</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-gray-400 text-xs">{ts(snap.timestamp_utc)}</span>
            <span className="text-gray-400 text-xs">{open ? "▲" : "▼"}</span>
          </div>
        </button>
        {open && (
          <div className="px-4 pb-4">
            <PodTable
              pods={snap.pods}
              liveRestarts={liveRestarts}
              onOpen={handleOpen}
            />
          </div>
        )}
      </div>
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function MonitorPage() {
  const [namespaces, setNamespaces] = useState<string[]>([]);
  const [clusters,   setClusters]   = useState<string[]>([]);

  const [filterMode, setFilterMode] = useState<"cluster" | "namespace">("cluster");
  const [selCluster,   setSelCluster]   = useState("");
  const [selNamespace, setSelNamespace] = useState("");

  const [snapshots, setSnapshots] = useState<MonitorSnapshot[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastFetch,  setLastFetch]  = useState<Date | null>(null);
  const [error,      setError]      = useState("");

  const [autoInterval, setAutoInterval] = useState<number>(() => {
    if (typeof window !== "undefined") {
      return Number(localStorage.getItem("monitor_interval") ?? 0);
    }
    return 0;
  });

  useEffect(() => {
    Promise.all([getMonitorNamespaces(), getMonitorClusters()]).then(
      ([ns, cl]) => { setNamespaces(ns); setClusters(cl); }
    );
  }, []);

  const load = useCallback(async () => {
    const params =
      filterMode === "cluster"
        ? { cluster: selCluster || undefined }
        : { namespace: selNamespace || undefined };

    setLoading(true);
    setError("");
    try {
      const data = await getMonitorPods(params);
      setSnapshots(data);
      setLastFetch(new Date());
    } catch (e: unknown) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [filterMode, selCluster, selNamespace]);

  // auto-load when selection changes
  useEffect(() => {
    load();
  }, [load]);

  // auto-refresh timer
  useEffect(() => {
    if (!autoInterval) return;
    const id = setInterval(() => { load(); }, autoInterval * 1000);
    return () => clearInterval(id);
  }, [autoInterval, load]);

  const handleIntervalChange = (val: number) => {
    setAutoInterval(val);
    localStorage.setItem("monitor_interval", String(val));
  };

  const reloadMeta = useCallback(async () => {
    const [ns, cl] = await Promise.all([getMonitorNamespaces(), getMonitorClusters()]);
    setNamespaces(ns);
    setClusters(cl);
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await triggerRun();
      // Runner async çalışır — tamamlanana kadar poll et (max 90 sn)
      for (let i = 0; i < 30; i++) {
        await new Promise((r) => setTimeout(r, 3000));
        const last = await getLastRun();
        if (last.status !== "running") break;
      }
      await Promise.all([load(), reloadMeta()]);
    } finally {
      setRefreshing(false);
    }
  };

  const problemCount = snapshots.filter((s) => s.status === "PROBLEM").length;

  return (
    <div className="flex-1 p-6 space-y-5 min-h-0 overflow-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Monitor</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {lastFetch
              ? `Son güncelleme: ${lastFetch.toLocaleTimeString("tr-TR")}`
              : "Yükleniyor..."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={autoInterval}
            onChange={(e) => handleIntervalChange(Number(e.target.value))}
            className="border rounded px-2 py-1.5 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-300"
            title="Otomatik yenileme aralığı"
          >
            <option value={0}>Otomatik yenileme kapalı</option>
            <option value={30}>30 saniye</option>
            <option value={60}>1 dakika</option>
            <option value={120}>2 dakika</option>
            <option value={300}>5 dakika</option>
          </select>
          <button
            onClick={handleRefresh}
            disabled={refreshing || loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <span>{refreshing ? "⟳" : "↻"}</span>
            {refreshing ? "Çalışıyor..." : "Yenile"}
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="bg-white border rounded-lg shadow-sm p-4 space-y-3">
        <div className="flex gap-2">
          <button
            onClick={() => setFilterMode("cluster")}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filterMode === "cluster"
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            Cluster
          </button>
          <button
            onClick={() => setFilterMode("namespace")}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filterMode === "namespace"
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            Namespace
          </button>
        </div>

        {filterMode === "cluster" ? (
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Cluster seç</label>
            <select
              value={selCluster}
              onChange={(e) => setSelCluster(e.target.value)}
              className="border rounded px-3 py-1.5 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-300"
            >
              <option value="">— Tümü —</option>
              {clusters.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        ) : (
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Namespace seç</label>
            <select
              value={selNamespace}
              onChange={(e) => setSelNamespace(e.target.value)}
              className="border rounded px-3 py-1.5 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-300"
            >
              <option value="">— Tümü —</option>
              {namespaces.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Summary bar */}
      {!loading && snapshots.length > 0 && (
        <div className="flex gap-4">
          <div className="bg-white border rounded-lg px-4 py-2 shadow-sm">
            <span className="text-xs text-gray-500">Toplam</span>
            <p className="text-lg font-bold">{snapshots.length}</p>
          </div>
          <div className="bg-white border rounded-lg px-4 py-2 shadow-sm">
            <span className="text-xs text-gray-500">Problem</span>
            <p className={`text-lg font-bold ${problemCount > 0 ? "text-red-600" : "text-gray-800"}`}>
              {problemCount}
            </p>
          </div>
          <div className="bg-white border rounded-lg px-4 py-2 shadow-sm">
            <span className="text-xs text-gray-500">Toplam Pod</span>
            <p className="text-lg font-bold">
              {snapshots.reduce((sum, s) => sum + s.pods.length, 0)}
            </p>
          </div>
        </div>
      )}

      {/* Results */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-gray-400 text-sm">Yükleniyor...</p>
      ) : snapshots.length === 0 ? (
        <p className="text-gray-400 text-sm italic">Snapshot bulunamadı.</p>
      ) : (
        <div>
          {snapshots.map((snap) => (
            <SnapshotCard key={`${snap.namespace}__${snap.cluster}`} snap={snap} />
          ))}
        </div>
      )}

    </div>
  );
}
