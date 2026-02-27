"use client";
import { useState, useEffect, useCallback } from "react";
import { triggerRun, getLastRun, type RunResult } from "@/lib/api";
import StatusBadge from "@/components/StatusBadge";

const EXIT_LABEL: Record<number, string> = { 0: "OK", 1: "PROBLEM", 2: "NOTIFY FAILED", 3: "LOCKED" };

export default function RunPage() {
  const [result, setResult]   = useState<RunResult | null>(null);
  const [running, setRunning] = useState(false);
  const [msg, setMsg]         = useState("");

  const poll = useCallback(async () => {
    const r = await getLastRun().catch(() => null);
    if (r) setResult(r);
    return r;
  }, []);

  useEffect(() => { poll(); }, [poll]);

  // running iken 2 sn'de bir poll et
  useEffect(() => {
    if (!running) return;
    const id = setInterval(async () => {
      const r = await poll();
      if (r?.status !== "running") setRunning(false);
    }, 2000);
    return () => clearInterval(id);
  }, [running, poll]);

  async function start() {
    setMsg("");
    try {
      await triggerRun();
      setRunning(true);
      setResult({ status: "running" });
    } catch (e: unknown) {
      setMsg(`Error: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const statusColor = result?.status === "done" && result.exit_code === 0
    ? "text-green-600"
    : result?.status === "running"
    ? "text-blue-600"
    : "text-red-600";

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Manual Run</h1>
      {msg && <div className="mb-4 px-4 py-2 rounded bg-red-50 text-red-700 text-sm">{msg}</div>}

      <div className="flex items-center gap-4 mb-6">
        <button onClick={start} disabled={running}
          className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 flex items-center gap-2">
          {running ? (
            <><span className="animate-spin">⟳</span> Running…</>
          ) : "▶  Run Now"}
        </button>
        <button onClick={poll}
          className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm">
          Refresh
        </button>
      </div>

      {result && result.status !== "never_run" && (
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="flex items-center justify-between px-5 py-4 border-b">
            <div className="flex items-center gap-3">
              <span className={`font-semibold ${statusColor}`}>
                {result.status === "running" ? "⟳ Running…"
                  : result.status === "done" ? `✓ Done`
                  : `✗ ${result.status}`}
              </span>
              {result.exit_code !== undefined && (
                <span className="text-sm text-gray-500">
                  exit {result.exit_code}
                  {EXIT_LABEL[result.exit_code] ? ` (${EXIT_LABEL[result.exit_code]})` : ""}
                </span>
              )}
            </div>
            <div className="text-xs text-gray-400 flex gap-4">
              {result.duration_sec != null && <span>{result.duration_sec}s</span>}
              {result.config && <span className="font-mono">{result.config}</span>}
            </div>
          </div>

          {result.stdout && (
            <div className="p-5">
              <p className="text-xs font-semibold text-gray-500 uppercase mb-2">stdout</p>
              <pre className="bg-gray-900 text-green-400 text-xs rounded p-4 overflow-x-auto whitespace-pre-wrap max-h-96">
                {result.stdout}
              </pre>
            </div>
          )}

          {result.stderr && (
            <div className="px-5 pb-5">
              <p className="text-xs font-semibold text-gray-500 uppercase mb-2">stderr</p>
              <pre className="bg-gray-900 text-red-400 text-xs rounded p-4 overflow-x-auto whitespace-pre-wrap max-h-48">
                {result.stderr}
              </pre>
            </div>
          )}
        </div>
      )}

      {result?.status === "never_run" && (
        <p className="text-gray-400 text-sm">Henüz çalıştırılmadı.</p>
      )}
    </div>
  );
}
