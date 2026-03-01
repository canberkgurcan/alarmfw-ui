"use client";
import { useState, useEffect } from "react";
import {
  getSecrets, uploadSecretText, deleteSecret,
  getObserveAuth,
  type Secret, type ObserveAuth,
} from "@/lib/api";

export default function SecretsPage() {
  const [secrets, setSecrets]   = useState<Secret[]>([]);
  const [cluster, setCluster]   = useState("");
  const [token, setToken]       = useState("");
  const [saving, setSaving]     = useState(false);
  const [msg, setMsg]           = useState("");

  // Global Prometheus token
  const [auth, setAuth]               = useState<ObserveAuth | null>(null);
  const [promToken, setPromToken]     = useState("");
  const [promSaving, setPromSaving]   = useState(false);

  async function load() {
    const data = await getSecrets().catch(() => []);
    setSecrets(data);
  }

  async function loadAuth() {
    const a = await getObserveAuth().catch(() => null);
    setAuth(a);
  }

  useEffect(() => {
    load();
    loadAuth();
  }, []);

  async function savePromToken() {
    const t = promToken.trim();
    if (!t) { setMsg("Token boş olamaz"); return; }
    setPromSaving(true);
    try {
      await uploadSecretText("prometheus", t);
      setMsg("✓ prometheus.token kaydedildi");
      setPromToken("");
      await Promise.all([load(), loadAuth()]);
    } catch (e: unknown) {
      setMsg(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setPromSaving(false);
    }
  }

  async function deletePromToken() {
    if (!confirm("prometheus.token silinsin mi? Observe sayfasında oturum kapanır.")) return;
    try {
      await deleteSecret("prometheus");
      setMsg("prometheus.token silindi");
      await Promise.all([load(), loadAuth()]);
    } catch (e: unknown) {
      setMsg(`Error: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

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

  const promSecret = secrets.find((s) => s.cluster === "prometheus");

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Secrets</h1>
      {msg && <div className="mb-4 px-4 py-2 rounded bg-blue-50 text-blue-700 text-sm">{msg}</div>}

      {/* Global Prometheus Token */}
      <div className="bg-white rounded-lg shadow-sm border mb-6">
        <div className="px-5 py-4 border-b font-semibold flex items-center justify-between">
          <span>Prometheus Token</span>
          {auth !== null && (
            <span className={`text-xs px-2 py-1 rounded-full font-medium ${
              auth.logged_in
                ? "bg-green-100 text-green-700"
                : "bg-yellow-100 text-yellow-700"
            }`}>
              {auth.logged_in ? "Bağlı" : "Token yok"}
            </span>
          )}
        </div>
        <div className="p-5 max-w-2xl space-y-3">
          {promSecret && (
            <div className="flex items-center justify-between text-sm">
              <div className="space-y-0.5">
                <p className="font-mono text-gray-500 text-xs">{promSecret.name}</p>
                <p className="text-gray-500 text-xs">{promSecret.size_bytes} B — son güncelleme: {new Date(promSecret.modified * 1000).toISOString().replace("T", " ").slice(0, 19)}</p>
              </div>
              <button
                onClick={deletePromToken}
                className="text-xs px-3 py-1 rounded bg-red-50 text-red-600 hover:bg-red-100"
              >
                Sil
              </button>
            </div>
          )}
          <div className="flex gap-2 items-end">
            <textarea
              value={promToken}
              onChange={(e) => setPromToken(e.target.value)}
              rows={3}
              placeholder={promSecret ? "Güncelle — yeni token girin…" : "eyJhbGci... veya sha256:eyJ..."}
              className="flex-1 border rounded px-3 py-2 text-sm font-mono resize-none"
            />
            <button
              onClick={savePromToken}
              disabled={promSaving}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm disabled:opacity-50 whitespace-nowrap"
            >
              {promSaving ? "Kaydediliyor…" : (promSecret ? "Güncelle" : "Kaydet")}
            </button>
          </div>
          <p className="text-xs text-gray-400">
            Token dosyası: <code className="bg-gray-50 border rounded px-1">prometheus.token</code> — tüm cluster&apos;lar bu token ile Prometheus&apos;a bağlanır.
          </p>
        </div>
      </div>

      {/* Cluster Tokens */}
      <div className="bg-white rounded-lg shadow-sm border mb-6">
        <div className="px-5 py-4 border-b font-semibold">Cluster OCP Token Dosyaları</div>
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
            {secrets.filter((s) => s.cluster !== "prometheus").length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">Token dosyası yok</td></tr>
            )}
            {secrets.filter((s) => s.cluster !== "prometheus").map((s) => (
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
        <h2 className="font-semibold mb-4">Cluster OCP Token Ekle / Güncelle</h2>
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
              rows={4} placeholder="eyJhbGci..."
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
