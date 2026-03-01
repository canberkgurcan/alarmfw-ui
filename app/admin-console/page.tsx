"use client";

import { useEffect, useRef, useState } from "react";
import {
  execTerminalCommand,
  getTerminalWhoami,
  getTerminalClusters,
  terminalLogin,
  TerminalResult,
} from "@/lib/api";

type HistoryEntry = { cmd: string; result: TerminalResult };

export default function AdminConsolePage() {
  const [input, setInput]           = useState("");
  const [history, setHistory]       = useState<HistoryEntry[]>([]);
  const [loading, setLoading]       = useState(false);
  const [whoami, setWhoami]         = useState<string | null>(null);
  const [cmdHistory, setCmdHistory] = useState<string[]>([]);
  const [histIdx, setHistIdx]       = useState(-1);
  const [clusters, setClusters]     = useState<{ name: string; ocp_api: string }[]>([]);
  const outputRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getTerminalWhoami().then((r) => setWhoami(r.logged_in ? r.user : null)).catch(() => {});
    getTerminalClusters().then(setClusters).catch(() => {});
  }, []);

  useEffect(() => {
    outputRef.current?.scrollTo({ top: outputRef.current.scrollHeight, behavior: "smooth" });
  }, [history]);

  const pushResult = (cmd: string, result: TerminalResult) => {
    setHistory((prev) => [...prev, { cmd, result }]);
    getTerminalWhoami().then((r) => setWhoami(r.logged_in ? r.user : null)).catch(() => {});
  };

  const run = async () => {
    const cmd = input.trim();
    if (!cmd || loading) return;
    setLoading(true);
    setInput("");
    setHistIdx(-1);
    setCmdHistory((prev) => [cmd, ...prev.slice(0, 49)]);
    try {
      const result = await execTerminalCommand(cmd);
      pushResult(cmd, result);
    } catch (e) {
      pushResult(cmd, { ok: false, stdout: "", stderr: String(e), exit_code: -1 });
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const login = async (clusterName: string) => {
    if (loading) return;
    setLoading(true);
    try {
      const result = await terminalLogin(clusterName);
      pushResult(`oc login [${clusterName}]`, result);
    } catch (e) {
      pushResult(`oc login [${clusterName}]`, { ok: false, stdout: "", stderr: String(e), exit_code: -1 });
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") { run(); return; }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      const next = Math.min(histIdx + 1, cmdHistory.length - 1);
      setHistIdx(next);
      setInput(cmdHistory[next] ?? "");
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = histIdx - 1;
      setHistIdx(next);
      setInput(next < 0 ? "" : cmdHistory[next] ?? "");
    }
  };

  return (
    <div className="p-6 space-y-4">
      {/* Başlık */}
      <div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Admin Console</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          OpenShift CLI — cluster seçerek oturum aç, ardından <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1 rounded">oc</code> komutlarını çalıştır.
        </p>
      </div>

      {/* Cluster login butonları */}
      {clusters.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500">Cluster login:</span>
          {clusters.map((c) => (
            <button
              key={c.name}
              onClick={() => login(c.name)}
              disabled={loading}
              title={c.ocp_api}
              className="px-3 py-1 rounded text-xs border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-green-500 hover:text-green-600 dark:hover:border-green-600 dark:hover:text-green-400 disabled:opacity-40 transition-colors"
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      {/* Terminal */}
      <div
        className="border rounded-lg shadow-sm flex flex-col bg-gray-950 text-gray-100 font-mono text-xs"
        style={{ minHeight: 420 }}
        onClick={() => inputRef.current?.focus()}
      >
        {/* Terminal header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800 shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
            <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
            <span className="ml-2 text-gray-500 text-xs">admin@alarmfw</span>
          </div>
          <div className="flex items-center gap-3">
            {whoami ? (
              <span className="text-green-400 text-xs">{whoami}</span>
            ) : (
              <span className="text-gray-600 text-xs">oturum yok</span>
            )}
            {history.length > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); setHistory([]); }}
                className="text-gray-600 hover:text-gray-400 text-xs"
              >
                temizle
              </button>
            )}
          </div>
        </div>

        {/* Output */}
        <div
          ref={outputRef}
          className="flex-1 overflow-y-auto px-4 py-3 space-y-3"
          style={{ minHeight: 320, maxHeight: 600 }}
        >
          {history.length === 0 && (
            <p className="text-gray-600 italic">
              Cluster seçerek oturum aç, ardından <span className="text-gray-400">oc get pods</span>, <span className="text-gray-400">oc whoami</span> gibi komutları çalıştır.
            </p>
          )}
          {history.map((entry, i) => (
            <div key={i}>
              <div className="flex gap-2 text-green-400">
                <span className="text-gray-500 shrink-0">$</span>
                <span className="break-all">{entry.cmd}</span>
              </div>
              {entry.result.stdout && (
                <pre className="whitespace-pre-wrap break-all text-gray-200 mt-0.5 leading-relaxed">
                  {entry.result.stdout}
                </pre>
              )}
              {entry.result.stderr && (
                <pre className={`whitespace-pre-wrap break-all mt-0.5 leading-relaxed ${
                  entry.result.ok ? "text-yellow-400" : "text-red-400"
                }`}>
                  {entry.result.stderr}
                </pre>
              )}
              {!entry.result.ok && entry.result.exit_code !== 0 && (
                <span className="text-gray-600 text-xs">exit {entry.result.exit_code}</span>
              )}
            </div>
          ))}
          {loading && <div className="text-gray-500 animate-pulse">...</div>}
        </div>

        {/* Input */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-t border-gray-800 shrink-0">
          <span className="text-green-500 shrink-0">$</span>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
            placeholder="komut girin..."
            className="flex-1 bg-transparent outline-none text-gray-100 placeholder-gray-700 font-mono text-xs"
            spellCheck={false}
            autoComplete="off"
            autoCorrect="off"
            autoFocus
          />
          {loading && <span className="text-gray-600 text-xs shrink-0">çalışıyor...</span>}
        </div>
      </div>
    </div>
  );
}
