"use client";
import { useState, useEffect } from "react";
import {
  getSecrets, uploadSecretText, deleteSecret,
  getObserveClusterConfigs, upsertObserveCluster, deleteObserveCluster,
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
  const [insecure, setInsecure] = useState(true);

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
    if (!name || !ocpApi.trim()) {
      setMsg("Cluster adı ve OCP API URL zorunludur");
      return;
    }
    const isNew = !allClusters.includes(name);
    if (isNew && !ocpToken.trim()) {
      setMsg("Yeni cluster için OCP Token zorunludur");
      return;
    }
    setSaving(true);
    setMsg("");
    try {
      if (ocpToken.trim()) {
        await uploadSecretText(name, ocpToken.trim());
      }
      if (promToken.trim()) {
        await uploadSecretText(`${name}-prometheus`, promToken.trim());
      }
      await upsertObserveCluster(name, {
        name,
        ocp_api: ocpApi.trim(),
        insecure,
        prometheus_url: promUrl.trim(),
      });
      setMsg(`✓ ${name} kaydedildi`);
      setCluster(""); setOcpApi(""); setOcpToken(""); setPromUrl(""); setPromToken(""); setInsecure(true);
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
    setInsecure(obs?.insecure ?? true);
    setOcpToken("");
    setPromToken("");
    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
  }

  function resetForm() {
    setCluster(""); setOcpApi(""); setOcpToken("");
    setPromUrl(""); setPromToken(""); setInsecure(true); setMsg("");
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
              <th className="px-4 py-3 text-center">TLS</th>
              <th className="px-4 py-3 text-center">OCP Token</th>
              <th className="px-4 py-3">Prometheus URL</th>
              <th className="px-4 py-3 text-center">Prom. Token</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {allClusters.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
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
                    <span className={`px-2 py-0.5 rounded text-xs ${obs?.insecure ? "bg-yellow-100 text-yellow-700" : "bg-gray-100 text-gray-500"}`}>
                      {obs?.insecure ? "skip" : "verify"}
                    </span>
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
              OCP Token{!allClusters.includes(cluster.trim()) && <span className="text-red-500"> *</span>}
            </span>
            <textarea value={ocpToken} onChange={(e) => setOcpToken(e.target.value)}
              rows={3}
              placeholder={allClusters.includes(cluster.trim()) ? "Boş bırakılırsa mevcut token değişmez" : "eyJhbGci..."}
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
          <div className="md:col-span-2 pt-1">
            <label className="flex items-center gap-2 cursor-pointer select-none text-sm">
              <div onClick={() => setInsecure(!insecure)}
                className={`w-10 h-5 rounded-full transition-colors flex items-center px-0.5 ${insecure ? "bg-blue-600" : "bg-gray-300"}`}>
                <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${insecure ? "translate-x-5" : "translate-x-0"}`} />
              </div>
              <span className="text-gray-700">TLS Verify&apos;ı Atla (insecure)</span>
            </label>
          </div>
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
