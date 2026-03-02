"use client";

import { useEffect, useRef, useState } from "react";
import {
  execTerminalCommand,
  getTerminalWhoami,
  getTerminalClusters,
  terminalLogin,
  getZabbixNamespaces,
  sendZabbixEvent,
  TerminalResult,
  ZabbixNamespace,
  ZabbixSendResult,
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

  // Zabbix state
  const [zbxNamespaces, setZbxNamespaces] = useState<ZabbixNamespace[]>([]);
  const [zbxSelected, setZbxSelected]     = useState<string>("");
  const [zbxSending, setZbxSending]       = useState<"1" | "2" | null>(null);
  const [zbxResult, setZbxResult]         = useState<ZabbixSendResult | null>(null);
  const [zbxError, setZbxError]           = useState<string>("");

  useEffect(() => {
    getTerminalWhoami().then((r) => setWhoami(r.logged_in ? r.user : null)).catch(() => {});
    getTerminalClusters().then(setClusters).catch(() => {});
    getZabbixNamespaces()
      .then((ns) => { setZbxNamespaces(ns); if (ns.length > 0) setZbxSelected(ns[0].name); })
      .catch(() => {});
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

  const zbxSend = async (type: "1" | "2") => {
    if (!zbxSelected) return;
    setZbxSending(type);
    setZbxResult(null);
    setZbxError("");
    try {
      const res = await sendZabbixEvent(zbxSelected, type);
      setZbxResult(res);
    } catch (e: unknown) {
      setZbxError(e instanceof Error ? e.message : String(e));
    } finally {
      setZbxSending(null);
    }
  };

  const zbxNs = zbxNamespaces.find((n) => n.name === zbxSelected);

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

      {/* ── Zabbix Event Gönder ── */}
      <div>
        <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-3">Zabbix Event Gönder</h2>

        {zbxNamespaces.length === 0 ? (
          <p className="text-sm text-gray-500">
            Zabbix etkin namespace bulunamadı. Config sayfasından bir namespace için Zabbix Enabled işaretleyin.
          </p>
        ) : (
          <div className="bg-white dark:bg-gray-900 border rounded-xl shadow-sm p-5 space-y-4">
            {/* Namespace seç */}
            <div className="flex items-center gap-3">
              <label className="text-sm text-gray-600 dark:text-gray-400 shrink-0">Namespace</label>
              <select
                value={zbxSelected}
                onChange={(e) => { setZbxSelected(e.target.value); setZbxResult(null); setZbxError(""); }}
                className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200"
              >
                {zbxNamespaces.map((n) => (
                  <option key={n.name} value={n.name}>{n.name}</option>
                ))}
              </select>
            </div>

            {/* Payload önizleme */}
            {zbxNs && (
              <div className="font-mono text-xs bg-gray-50 dark:bg-gray-800 border rounded-lg p-3 space-y-0.5 text-gray-700 dark:text-gray-300 leading-relaxed">
                <div><span className="text-purple-500">&quot;type&quot;</span>: <span className="text-orange-500">&quot;1&quot;</span> | <span className="text-orange-500">&quot;2&quot;</span></div>
                <div><span className="text-purple-500">&quot;severity&quot;</span>: <span className="text-green-600">&quot;{zbxNs.severity}&quot;</span></div>
                <div><span className="text-purple-500">&quot;alertgroup&quot;</span>: <span className="text-green-600">&quot;{zbxNs.alertgroup}&quot;</span></div>
                <div><span className="text-purple-500">&quot;alertkey&quot;</span>: <span className="text-green-600">&quot;{zbxNs.alertkey}&quot;</span></div>
                <div><span className="text-purple-500">&quot;node&quot;</span>: <span className="text-green-600">&quot;{zbxNs.node}&quot;</span></div>
                <div><span className="text-purple-500">&quot;department&quot;</span>: <span className="text-green-600">&quot;{zbxNs.department}&quot;</span></div>
                <div><span className="text-purple-500">&quot;occurrencedate&quot;</span>: <span className="text-gray-400">[gönderim anı]</span></div>
                <div><span className="text-purple-500">&quot;tablename&quot;</span>: <span className="text-green-600">&quot;italarm&quot;</span></div>
              </div>
            )}

            {/* Butonlar */}
            <div className="flex gap-3">
              <button
                onClick={() => zbxSend("1")}
                disabled={!!zbxSending}
                className="px-5 py-2 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {zbxSending === "1" ? "Gönderiliyor…" : "⚠ Alarm"}
              </button>
              <button
                onClick={() => zbxSend("2")}
                disabled={!!zbxSending}
                className="px-5 py-2 rounded-lg text-sm font-medium bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {zbxSending === "2" ? "Gönderiliyor…" : "✓ Clear"}
              </button>
            </div>

            {/* Hata */}
            {zbxError && (
              <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg px-4 py-2">
                {zbxError}
              </div>
            )}

            {/* Sonuç */}
            {zbxResult && (
              <div className="border rounded-lg overflow-hidden text-xs font-mono">
                <div className={`px-4 py-2 font-sans text-sm font-medium flex gap-2 items-center ${
                  zbxResult.ok
                    ? "bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-400 border-b border-green-200 dark:border-green-800"
                    : "bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-400 border-b border-red-200 dark:border-red-800"
                }`}>
                  <span>{zbxResult.ok ? "✓ Başarılı" : "✗ Başarısız"}</span>
                  {zbxResult.status_code != null && (
                    <span className="opacity-60">HTTP {zbxResult.status_code}</span>
                  )}
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-800 space-y-3">
                  <div>
                    <p className="text-gray-500 mb-1 text-xs">Gönderilen payload</p>
                    <pre className="whitespace-pre-wrap text-gray-700 dark:text-gray-300">
                      {JSON.stringify(zbxResult.payload, null, 2)}
                    </pre>
                  </div>
                  <div>
                    <p className="text-gray-500 mb-1 text-xs">{zbxResult.error ? "Hata" : "Zabbix yanıtı"}</p>
                    <pre className="whitespace-pre-wrap text-gray-700 dark:text-gray-300">
                      {zbxResult.error ?? JSON.stringify(zbxResult.response, null, 2)}
                    </pre>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
