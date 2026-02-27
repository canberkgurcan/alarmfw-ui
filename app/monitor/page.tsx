"use client";

import { useEffect, useState, useCallback } from "react";
import {
  getMonitorPods,
  getMonitorNamespaces,
  getMonitorClusters,
  runPromQL,
  triggerRun,
  getLastRun,
  MonitorSnapshot,
  PodInfo,
  PromQLResult,
} from "@/lib/api";

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

function PodTable({ pods }: { pods: PodInfo[] }) {
  if (!pods.length)
    return <p className="text-sm text-gray-400 italic">Pod yok</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-gray-50 text-gray-500 uppercase tracking-wide">
            {["Pod", "Ready", "Restarts", "Phase", "Waiting / Terminated", "Node", "Workload", "Image", "Oluşturma"].map(
              (h) => (
                <th key={h} className="px-2 py-1.5 text-left border-b whitespace-nowrap">
                  {h}
                </th>
              )
            )}
          </tr>
        </thead>
        <tbody>
          {pods.map((p) => (
            <tr key={p.pod} className="border-b hover:bg-gray-50">
              <td className="px-2 py-1.5 font-mono max-w-[180px] truncate" title={p.pod}>
                {p.pod}
              </td>
              <td className="px-2 py-1.5">{readyBadge(p.ready_str)}</td>
              <td className="px-2 py-1.5 text-center">{p.restarts}</td>
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
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── SnapshotCard ──────────────────────────────────────────────────────────────

function SnapshotCard({ snap }: { snap: MonitorSnapshot }) {
  const [open, setOpen] = useState(true);
  return (
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
          <PodTable pods={snap.pods} />
        </div>
      )}
    </div>
  );
}

// ── PromQL Panel ──────────────────────────────────────────────────────────────

function PromQLPanel() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<PromQLResult | null>(null);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const r = await runPromQL(query.trim());
      setResult(r);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border rounded-lg bg-white shadow-sm p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">PromQL</h3>
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
        <div className="mt-3">
          {!result.ok ? (
            <p className="text-red-600 text-sm">{result.error}</p>
          ) : result.result.length === 0 ? (
            <p className="text-gray-400 text-sm italic">Sonuç yok</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse mt-1">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 uppercase tracking-wide">
                    <th className="px-2 py-1.5 text-left border-b">Metrik</th>
                    <th className="px-2 py-1.5 text-left border-b">Değer</th>
                  </tr>
                </thead>
                <tbody>
                  {result.result.map((r, i) => {
                    const label = Object.entries(r.metric)
                      .map(([k, v]) => `${k}="${v}"`)
                      .join(", ");
                    const val = r.value ? r.value[1] : "—";
                    return (
                      <tr key={i} className="border-b hover:bg-gray-50">
                        <td className="px-2 py-1.5 font-mono text-gray-600 max-w-[400px] break-all">
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
        <button
          onClick={handleRefresh}
          disabled={refreshing || loading}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          <span>{refreshing ? "⟳" : "↻"}</span>
          {refreshing ? "Çalışıyor..." : "Yenile"}
        </button>
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

      {/* PromQL */}
      <PromQLPanel />
    </div>
  );
}
