"use client";
import { useState, useEffect } from "react";
import {
  getSecrets, uploadSecretText, deleteSecret,
  getObserveClusterConfigs, upsertObserveCluster, deleteObserveCluster,
  upsertCluster,
  type Secret, type ObserveClusterConfig,
} from "@/lib/api";

// cluster adı → token dosyaları map'i
type TokenMap = Record<string, { ocp?: Secret; prometheus?: Secret }>;

function buildTokenMap(secrets: Secret[]): TokenMap {
  const map: TokenMap = {};
  for (const s of secrets) {
    if (s.cluster === "prometheus") continue; // eski global token, yoksay
    const isPrometheus = s.cluster.endsWith("-prometheus");
    const base = isPrometheus ? s.cluster.replace(/-prometheus$/, "") : s.cluster;
    if (!map[base]) map[base] = {};
    if (isPrometheus) map[base].prometheus = s;
    else map[base].ocp = s;
  }
  return map;
}

function fmtDate(ts: number) {
  return new Date(ts * 1000).toISOString().replace("T", " ").slice(0, 16);
}

export default function SecretsPage() {
  const [secrets, setSecrets]             = useState<Secret[]>([]);
  const [observeClusters, setObsClusters] = useState<ObserveClusterConfig[]>([]);
  const [msg, setMsg]                     = useState("");
  const [saving, setSaving]               = useState(false);

  // form state
  const [cluster, setCluster]   = useState("");
  const [ocpApi, setOcpApi]     = useState("");
  const [ocpToken, setOcpToken] = useState("");
  const [promUrl, setPromUrl]   = useState("");
  const [promToken, setPromToken] = useState("");

  async function load() {
    const [s, o] = await Promise.all([
      getSecrets().catch(() => [] as Secret[]),
      getObserveClusterConfigs().catch(() => [] as ObserveClusterConfig[]),
    ]);
    setSecrets(s);
    setObsClusters(o);
  }

  useEffect(() => { load(); }, []);

  const tokenMap = buildTokenMap(secrets);
  const allClusters = Array.from(new Set([
    ...Object.keys(tokenMap),
    ...observeClusters.map((c) => c.name),
  ])).sort();

  function findObsConfig(name: string) {
    return observeClusters.find((c) => c.name === name);
  }

  async function save() {
    const name = cluster.trim();
    if (!name || !ocpApi.trim() || !ocpToken.trim()) {
      setMsg("Cluster adı, OCP API URL ve OCP Token zorunludur");
      return;
    }
    setSaving(true);
    setMsg("");
    try {
      await uploadSecretText(name, ocpToken.trim());
      if (promToken.trim()) {
        await uploadSecretText(`${name}-prometheus`, promToken.trim());
      }
      await upsertCluster(name, { name, ocp_api: ocpApi.trim(), insecure: true });
      await upsertObserveCluster(name, {
        name,
        ocp_api: ocpApi.trim(),
        prometheus_url: promUrl.trim(),
      });
      setMsg(`✓ ${name} kaydedildi`);
      setCluster(""); setOcpApi(""); setOcpToken(""); setPromUrl(""); setPromToken("");
      await load();
    } catch (e: unknown) {
      setMsg(`Hata: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSaving(false);
    }
  }

  async function removeCluster(name: string) {
    if (!confirm(`"${name}" cluster'ı ve tüm token dosyaları silinsin mi?`)) return;
    try {
      await Promise.allSettled([
        deleteSecret(name),
        deleteSecret(`${name}-prometheus`),
        deleteObserveCluster(name),
      ]);
      setMsg(`${name} silindi`);
      await load();
    } catch (e: unknown) {
      setMsg(`Hata: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  function editCluster(name: string) {
    const obs = findObsConfig(name);
    setCluster(name);
    setOcpApi(obs?.ocp_api ?? "");
    setPromUrl(obs?.prometheus_url ?? "");
    setOcpToken("");
    setPromToken("");
    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
  }

  function resetForm() {
    setCluster(""); setOcpApi(""); setOcpToken("");
    setPromUrl(""); setPromToken(""); setMsg("");
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Secrets</h1>
      {msg && (
        <div className={`mb-4 px-4 py-2 rounded text-sm ${
          msg.startsWith("Hata") ? "bg-red-50 text-red-700" : "bg-blue-50 text-blue-700"
        }`}>{msg}</div>
      )}

      {/* Cluster tablosu */}
      <div className="bg-white rounded-lg shadow-sm border mb-6">
        <div className="px-5 py-4 border-b font-semibold">Cluster&apos;lar</div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-xs uppercase text-gray-500 border-b text-left">
              <th className="px-4 py-3">Cluster</th>
              <th className="px-4 py-3">OCP API URL</th>
              <th className="px-4 py-3 text-center">OCP Token</th>
              <th className="px-4 py-3">Prometheus URL</th>
              <th className="px-4 py-3 text-center">Prom. Token</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {allClusters.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  Henüz cluster eklenmemiş
                </td>
              </tr>
            )}
            {allClusters.map((name) => {
              const tokens = tokenMap[name] ?? {};
              const obs = findObsConfig(name);
              return (
                <tr key={name} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500 max-w-[200px] truncate" title={obs?.ocp_api}>
                    {obs?.ocp_api ?? <span className="text-orange-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {tokens.ocp
                      ? <span className="text-green-600 text-xs font-medium" title={fmtDate(tokens.ocp.modified)}>✓</span>
                      : <span className="text-red-400 text-xs">Yok</span>}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500 max-w-[180px] truncate" title={obs?.prometheus_url}>
                    {obs?.prometheus_url || <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {tokens.prometheus
                      ? <span className="text-green-600 text-xs font-medium" title={fmtDate(tokens.prometheus.modified)}>✓</span>
                      : <span className="text-gray-400 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => editCluster(name)}
                        className="text-xs px-3 py-1 rounded bg-blue-50 text-blue-600 hover:bg-blue-100">
                        Düzenle
                      </button>
                      <button onClick={() => removeCluster(name)}
                        className="text-xs px-3 py-1 rounded bg-red-50 text-red-600 hover:bg-red-100">
                        Sil
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Cluster ekleme / düzenleme formu */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h2 className="font-semibold mb-5">
          {cluster ? `Cluster Güncelle — ${cluster}` : "Cluster Ekle"}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl">
          <label className="block text-sm">
            <span className="text-gray-600 font-medium">
              Cluster Adı <span className="text-red-500">*</span>
            </span>
            <input value={cluster} onChange={(e) => setCluster(e.target.value)}
              placeholder="izm-digital"
              className="mt-1 block w-full border rounded px-3 py-2 text-sm font-mono" />
          </label>
          <label className="block text-sm">
            <span className="text-gray-600 font-medium">
              OCP API URL <span className="text-red-500">*</span>
            </span>
            <input value={ocpApi} onChange={(e) => setOcpApi(e.target.value)}
              placeholder="https://api.cluster.domain:6443"
              className="mt-1 block w-full border rounded px-3 py-2 text-sm font-mono" />
          </label>
          <label className="block text-sm md:col-span-2">
            <span className="text-gray-600 font-medium">
              OCP Token <span className="text-red-500">*</span>
            </span>
            <textarea value={ocpToken} onChange={(e) => setOcpToken(e.target.value)}
              rows={3} placeholder="eyJhbGci..."
              className="mt-1 block w-full border rounded px-3 py-2 text-sm font-mono resize-none" />
          </label>
          <label className="block text-sm">
            <span className="text-gray-600 font-medium">Prometheus URL</span>
            <input value={promUrl} onChange={(e) => setPromUrl(e.target.value)}
              placeholder="https://thanos-querier.apps.cluster.domain"
              className="mt-1 block w-full border rounded px-3 py-2 text-sm font-mono" />
          </label>
          <label className="block text-sm">
            <span className="text-gray-600 font-medium">Prometheus Token</span>
            <textarea value={promToken} onChange={(e) => setPromToken(e.target.value)}
              rows={3} placeholder="eyJhbGci... (boş bırakılabilir)"
              className="mt-1 block w-full border rounded px-3 py-2 text-sm font-mono resize-none" />
          </label>
        </div>
        <div className="mt-5 flex gap-3 items-center flex-wrap">
          <button onClick={save} disabled={saving}
            className="px-5 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm disabled:opacity-50">
            {saving ? "Kaydediliyor…" : "Kaydet"}
          </button>
          {cluster && (
            <button onClick={resetForm}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
              İptal
            </button>
          )}
          <p className="text-xs text-gray-400">
            Token alanları boş bırakılırsa mevcut dosyalar değişmez.
          </p>
        </div>
      </div>
    </div>
  );
}
