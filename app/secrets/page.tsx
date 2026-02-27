"use client";
import { useState, useEffect } from "react";
import {
  getSecrets, uploadSecretText, deleteSecret,
  getObserveClusters,
  type Secret, type ObserveCluster,
} from "@/lib/api";

export default function SecretsPage() {
  const [secrets, setSecrets]   = useState<Secret[]>([]);
  const [cluster, setCluster]   = useState("");
  const [token, setToken]       = useState("");
  const [saving, setSaving]     = useState(false);
  const [msg, setMsg]           = useState("");

  const [observeClusters, setObserveClusters] = useState<ObserveCluster[]>([]);
  // per-cluster prometheus token input state: { clusterName: tokenValue }
  const [promTokens, setPromTokens]   = useState<Record<string, string>>({});
  const [promSaving, setPromSaving]   = useState<Record<string, boolean>>({});

  async function load() {
    const data = await getSecrets().catch(() => []);
    setSecrets(data);
  }

  useEffect(() => {
    load();
    getObserveClusters().catch(() => []).then((cs) =>
      setObserveClusters(cs.filter((c) => c.prometheus_url))
    );
  }, []);

  async function upload() {
    if (!cluster.trim() || !token.trim()) { setMsg("Cluster adı ve token gerekli"); return; }
    setSaving(true);
    try {
      await uploadSecretText(cluster.trim(), token.trim());
      setMsg(`✓ ${cluster}.token kaydedildi`);
      setCluster(""); setToken("");
      await load();
    } catch (e: unknown) {
      setMsg(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSaving(false);
    }
  }

  async function savePromToken(clusterName: string) {
    const t = (promTokens[clusterName] ?? "").trim();
    if (!t) { setMsg("Token boş olamaz"); return; }
    setPromSaving((s) => ({ ...s, [clusterName]: true }));
    try {
      await uploadSecretText(`${clusterName}-prometheus`, t);
      setMsg(`✓ ${clusterName}-prometheus.token kaydedildi`);
      setPromTokens((p) => ({ ...p, [clusterName]: "" }));
      await load();
    } catch (e: unknown) {
      setMsg(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setPromSaving((s) => ({ ...s, [clusterName]: false }));
    }
  }

  async function remove(c: string) {
    if (!confirm(`Delete ${c}.token?`)) return;
    try {
      await deleteSecret(c);
      setMsg(`Deleted ${c}.token`);
      await load();
    } catch (e: unknown) {
      setMsg(`Error: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  function promSecret(clusterName: string) {
    return secrets.find((s) => s.cluster === `${clusterName}-prometheus`);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Secrets</h1>
      {msg && <div className="mb-4 px-4 py-2 rounded bg-blue-50 text-blue-700 text-sm">{msg}</div>}

      {/* Per-cluster Prometheus Tokens */}
      {observeClusters.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border mb-6">
          <div className="px-5 py-4 border-b font-semibold">Prometheus Tokens</div>
          <div className="divide-y">
            {observeClusters.map((oc) => {
              const ps = promSecret(oc.name);
              const isSaving = promSaving[oc.name] ?? false;
              return (
                <div key={oc.name} className="p-5 space-y-3 max-w-2xl">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{oc.name}</span>
                    {ps ? (
                      <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700 font-medium">
                        Kayıtlı — {ps.size_bytes} B
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-1 rounded-full bg-yellow-100 text-yellow-700 font-medium">
                        Token yok
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span className="shrink-0">Hedef:</span>
                    <span className="font-mono bg-gray-50 border rounded px-2 py-0.5 truncate text-gray-700">
                      {oc.prometheus_url}
                    </span>
                  </div>
                  <div className="flex gap-2 items-end">
                    <textarea
                      value={promTokens[oc.name] ?? ""}
                      onChange={(e) => setPromTokens((p) => ({ ...p, [oc.name]: e.target.value }))}
                      rows={2}
                      placeholder={ps ? "Güncelle…" : "sha256:eyJ..."}
                      className="flex-1 border rounded px-3 py-2 text-sm font-mono resize-none"
                    />
                    <button
                      onClick={() => savePromToken(oc.name)}
                      disabled={isSaving}
                      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm disabled:opacity-50 whitespace-nowrap"
                    >
                      {isSaving ? "Kaydediliyor…" : (ps ? "Güncelle" : "Kaydet")}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Cluster Tokens */}
      <div className="bg-white rounded-lg shadow-sm border mb-6">
        <div className="px-5 py-4 border-b font-semibold">Cluster Token Dosyaları</div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-xs uppercase text-gray-500 border-b text-left">
              <th className="px-4 py-3">Cluster</th>
              <th className="px-4 py-3">Dosya</th>
              <th className="px-4 py-3">Boyut</th>
              <th className="px-4 py-3">Son Güncelleme</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {secrets.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">Token dosyası yok</td></tr>
            )}
            {secrets.map((s) => (
              <tr key={s.cluster} className="border-t hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{s.cluster}</td>
                <td className="px-4 py-3 font-mono text-xs text-gray-500">{s.name}</td>
                <td className="px-4 py-3 text-gray-500">{s.size_bytes} B</td>
                <td className="px-4 py-3 text-gray-500 text-xs">
                  {new Date(s.modified * 1000).toISOString().replace("T", " ").slice(0, 19)}
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => remove(s.cluster)}
                    className="text-xs px-3 py-1 rounded bg-red-50 text-red-600 hover:bg-red-100">
                    Sil
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Upload form */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h2 className="font-semibold mb-4">Cluster Token Ekle / Güncelle</h2>
        <div className="space-y-4 max-w-lg">
          <label className="block text-sm">
            <span className="text-gray-600 font-medium">Cluster Adı</span>
            <input value={cluster} onChange={(e) => setCluster(e.target.value)}
              placeholder="esy2-digital"
              className="mt-1 block w-full border rounded px-3 py-2 text-sm font-mono" />
          </label>
          <label className="block text-sm">
            <span className="text-gray-600 font-medium">Token</span>
            <textarea value={token} onChange={(e) => setToken(e.target.value)}
              rows={4} placeholder="sha256:..."
              className="mt-1 block w-full border rounded px-3 py-2 text-sm font-mono resize-none" />
          </label>
          <button onClick={upload} disabled={saving}
            className="px-5 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm disabled:opacity-50">
            {saving ? "Kaydediliyor…" : "Kaydet"}
          </button>
        </div>
      </div>
    </div>
  );
}
