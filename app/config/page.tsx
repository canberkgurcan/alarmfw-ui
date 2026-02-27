"use client";
import { useState, useEffect, useCallback } from "react";
import {
  getNamespaces, upsertNamespace, deleteNamespace,
  getClusters, upsertCluster, deleteCluster, generateConfig,
  uploadSecretText,
  type Namespace, type Cluster,
} from "@/lib/api";

const EMPTY_NS: Namespace = {
  name: "", namespace_enabled: true, clusters: [],
  zabbix_enabled: false, mail_enabled: false,
  severity: "5", node: "", department: "",
  alertkey: "OCP_POD_HEALTH", alertgroup: "",
  mail_to: "", mail_cc: "",
};

const EMPTY_CL: Cluster = { name: "", ocp_api: "", insecure: true };

export default function ConfigPage() {
  const [namespaces, setNamespaces] = useState<Namespace[]>([]);
  const [clusters,   setClusters]   = useState<Cluster[]>([]);
  const [nsEdit,     setNsEdit]     = useState<Namespace | null>(null);
  const [clEdit,     setClEdit]     = useState<Cluster | null>(null);
  const [clToken,    setClToken]    = useState("");
  const [msg,        setMsg]        = useState("");
  const [saving,     setSaving]     = useState(false);
  const [tab,        setTab]        = useState<"ns" | "cl">("ns");

  const load = useCallback(async () => {
    const [ns, cl] = await Promise.all([
      getNamespaces().catch(() => []),
      getClusters().catch(() => []),
    ]);
    setNamespaces(ns);
    setClusters(cl);
  }, []);

  useEffect(() => { load(); }, [load]);

  function flash(m: string) { setMsg(m); setTimeout(() => setMsg(""), 4000); }

  // ── Namespace save ──────────────────────────────────
  async function saveNs() {
    if (!nsEdit) return;
    if (!nsEdit.name.trim()) { flash("Namespace adı gerekli"); return; }
    setSaving(true);
    try {
      const res = await upsertNamespace(nsEdit.name.trim(), nsEdit);
      flash(`✓ Kaydedildi — ${res.generated_checks} check üretildi`);
      setNsEdit(null);
      await load();
    } catch (e: unknown) {
      flash(`Hata: ${e instanceof Error ? e.message : String(e)}`);
    } finally { setSaving(false); }
  }

  async function deleteNs(name: string) {
    if (!confirm(`"${name}" namespace'ini sil?`)) return;
    try {
      await deleteNamespace(name);
      flash(`Silindi: ${name}`);
      await load();
    } catch (e: unknown) {
      flash(`Hata: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // ── Cluster save ────────────────────────────────────
  async function saveCl() {
    if (!clEdit) return;
    if (!clEdit.name.trim()) { flash("Cluster adı gerekli"); return; }
    setSaving(true);
    try {
      await upsertCluster(clEdit.name.trim(), clEdit);
      if (clToken.trim()) {
        await uploadSecretText(clEdit.name.trim(), clToken.trim());
      }
      flash(`✓ Cluster kaydedildi`);
      setClEdit(null);
      setClToken("");
      await load();
    } catch (e: unknown) {
      flash(`Hata: ${e instanceof Error ? e.message : String(e)}`);
    } finally { setSaving(false); }
  }

  async function deleteCl(name: string) {
    if (!confirm(`"${name}" cluster'ını sil?`)) return;
    try {
      await deleteCluster(name);
      flash(`Silindi: ${name}`);
      await load();
    } catch (e: unknown) {
      flash(`Hata: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  async function generate() {
    try {
      const r = await generateConfig();
      flash(`✓ YAML üretildi — ${r.generated_checks} check`);
    } catch (e: unknown) {
      flash(`Hata: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Config</h1>
        <button onClick={generate}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium">
          ⟳ YAML Üret
        </button>
      </div>

      {msg && <div className="mb-4 px-4 py-2 rounded bg-blue-50 text-blue-700 text-sm">{msg}</div>}

      {/* Tabs */}
      <div className="flex gap-1 mb-5 border-b">
        {(["ns", "cl"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}>
            {t === "ns" ? `Namespaces (${namespaces.length})` : `Clusters (${clusters.length})`}
          </button>
        ))}
      </div>

      {/* ── Namespaces ── */}
      {tab === "ns" && (
        <div>
          <div className="flex justify-end mb-3">
            <button onClick={() => setNsEdit({ ...EMPTY_NS })}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
              + Namespace Ekle
            </button>
          </div>

          <div className="bg-white rounded-lg shadow-sm border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs uppercase text-gray-500 border-b text-left">
                  <th className="px-4 py-3">Namespace</th>
                  <th className="px-4 py-3">Cluster(lar)</th>
                  <th className="px-4 py-3">Enabled</th>
                  <th className="px-4 py-3">Zabbix</th>
                  <th className="px-4 py-3">Mail</th>
                  <th className="px-4 py-3">Node</th>
                  <th className="px-4 py-3">Severity</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {namespaces.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Namespace yok</td></tr>
                )}
                {namespaces.map((ns) => (
                  <tr key={ns.name} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{ns.name}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{ns.clusters.join(", ") || "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${ns.namespace_enabled ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                        {ns.namespace_enabled ? "Yes" : "No"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs ${ns.zabbix_enabled ? "bg-blue-100 text-blue-700" : "text-gray-400"}`}>
                        {ns.zabbix_enabled ? "✓" : "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs ${ns.mail_enabled ? "bg-purple-100 text-purple-700" : "text-gray-400"}`}>
                        {ns.mail_enabled ? "✓" : "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{ns.node || "—"}</td>
                    <td className="px-4 py-3 text-gray-600">{ns.severity}</td>
                    <td className="px-4 py-3 flex gap-2">
                      <button onClick={() => setNsEdit({ ...ns })}
                        className="text-xs px-3 py-1 rounded bg-blue-50 text-blue-600 hover:bg-blue-100">Düzenle</button>
                      <button onClick={() => deleteNs(ns.name)}
                        className="text-xs px-3 py-1 rounded bg-red-50 text-red-600 hover:bg-red-100">Sil</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Clusters ── */}
      {tab === "cl" && (
        <div>
          <div className="flex justify-end mb-3">
            <button onClick={() => { setClEdit({ ...EMPTY_CL }); setClToken(""); }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
              + Cluster Ekle
            </button>
          </div>

          <div className="bg-white rounded-lg shadow-sm border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs uppercase text-gray-500 border-b text-left">
                  <th className="px-4 py-3">Cluster</th>
                  <th className="px-4 py-3">API URL</th>
                  <th className="px-4 py-3">TLS Skip</th>
                  <th className="px-4 py-3">Token</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {clusters.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">Cluster yok</td></tr>
                )}
                {clusters.map((cl) => (
                  <tr key={cl.name} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{cl.name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{cl.ocp_api || "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs ${cl.insecure ? "bg-yellow-100 text-yellow-700" : "bg-gray-100 text-gray-500"}`}>
                        {cl.insecure ? "skip" : "verify"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${cl.has_token_file ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                        {cl.has_token_file ? "✓ var" : "✗ yok"}
                      </span>
                    </td>
                    <td className="px-4 py-3 flex gap-2">
                      <button onClick={() => { setClEdit({ ...cl }); setClToken(""); }}
                        className="text-xs px-3 py-1 rounded bg-blue-50 text-blue-600 hover:bg-blue-100">Düzenle</button>
                      <button onClick={() => deleteCl(cl.name)}
                        className="text-xs px-3 py-1 rounded bg-red-50 text-red-600 hover:bg-red-100">Sil</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Namespace Modal ── */}
      {nsEdit && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold mb-5">
              {namespaces.find(n => n.name === nsEdit.name) ? `Düzenle: ${nsEdit.name}` : "Yeni Namespace"}
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Namespace Adı">
                <input value={nsEdit.name} onChange={(e) => setNsEdit({ ...nsEdit, name: e.target.value })}
                  disabled={!!namespaces.find(n => n.name === nsEdit.name)}
                  className="input font-mono" placeholder="webstore" />
              </Field>
              <Field label="Cluster(lar)">
                <div className="border rounded p-2 space-y-1 max-h-36 overflow-y-auto bg-white">
                  {clusters.length === 0 && (
                    <p className="text-xs text-gray-400 px-1">Önce Clusters tabından cluster ekle</p>
                  )}
                  {clusters.map((cl) => (
                    <label key={cl.name} className="flex items-center gap-2 cursor-pointer px-1 py-0.5 rounded hover:bg-gray-50 text-sm">
                      <input
                        type="checkbox"
                        checked={nsEdit.clusters.includes(cl.name)}
                        onChange={(e) => {
                          const next = e.target.checked
                            ? [...nsEdit.clusters, cl.name]
                            : nsEdit.clusters.filter(c => c !== cl.name);
                          setNsEdit({ ...nsEdit, clusters: next });
                        }}
                        className="accent-blue-600"
                      />
                      <span className="font-mono">{cl.name}</span>
                    </label>
                  ))}
                </div>
              </Field>
              <Field label="Node">
                <input value={nsEdit.node} onChange={(e) => setNsEdit({ ...nsEdit, node: e.target.value })}
                  className="input" placeholder="SOT" />
              </Field>
              <Field label="Department">
                <input value={nsEdit.department} onChange={(e) => setNsEdit({ ...nsEdit, department: e.target.value })}
                  className="input" placeholder="STOREONTABLET" />
              </Field>
              <Field label="Severity">
                <select value={nsEdit.severity} onChange={(e) => setNsEdit({ ...nsEdit, severity: e.target.value })}
                  className="input">
                  {["1","2","3","4","5"].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="Alert Key">
                <input value={nsEdit.alertkey} onChange={(e) => setNsEdit({ ...nsEdit, alertkey: e.target.value })}
                  className="input font-mono" />
              </Field>
              <Field label="Alert Group">
                <input value={nsEdit.alertgroup} onChange={(e) => setNsEdit({ ...nsEdit, alertgroup: e.target.value })}
                  className="input font-mono" />
              </Field>
              <div className="col-span-2 flex gap-6 pt-1">
                <Toggle label="Namespace Enabled" checked={nsEdit.namespace_enabled}
                  onChange={(v) => setNsEdit({ ...nsEdit, namespace_enabled: v })} />
                <Toggle label="Zabbix" checked={nsEdit.zabbix_enabled}
                  onChange={(v) => setNsEdit({ ...nsEdit, zabbix_enabled: v })} />
                <Toggle label="Mail" checked={nsEdit.mail_enabled}
                  onChange={(v) => setNsEdit({ ...nsEdit, mail_enabled: v })} />
              </div>
              {nsEdit.mail_enabled && <>
                <Field label="Mail To">
                  <input value={nsEdit.mail_to} onChange={(e) => setNsEdit({ ...nsEdit, mail_to: e.target.value })}
                    className="input" placeholder="user@example.com" />
                </Field>
                <Field label="Mail CC">
                  <input value={nsEdit.mail_cc} onChange={(e) => setNsEdit({ ...nsEdit, mail_cc: e.target.value })}
                    className="input" placeholder="cc@example.com" />
                </Field>
              </>}
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={saveNs} disabled={saving}
                className="px-5 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm disabled:opacity-50">
                {saving ? "Kaydediliyor…" : "Kaydet"}
              </button>
              <button onClick={() => setNsEdit(null)}
                className="px-5 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-sm">İptal</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Cluster Modal ── */}
      {clEdit && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
            <h2 className="text-lg font-bold mb-5">
              {clusters.find(c => c.name === clEdit.name) ? `Düzenle: ${clEdit.name}` : "Yeni Cluster"}
            </h2>
            <div className="space-y-4">
              <Field label="Cluster Adı">
                <input value={clEdit.name} onChange={(e) => setClEdit({ ...clEdit, name: e.target.value })}
                  disabled={!!clusters.find(c => c.name === clEdit.name)}
                  className="input font-mono" placeholder="esy2-digital" />
              </Field>
              <Field label="OCP API URL">
                <input value={clEdit.ocp_api} onChange={(e) => setClEdit({ ...clEdit, ocp_api: e.target.value })}
                  className="input font-mono" placeholder="https://api.cluster.example.com:6443" />
              </Field>
              <Field label="Token">
                <input type="password" value={clToken} onChange={(e) => setClToken(e.target.value)}
                  className="input font-mono"
                  placeholder={clusters.find(c => c.name === clEdit.name) ? "Değiştirmek için yeni token gir (boş bırakınca mevcut korunur)" : "oc whoami -t"} />
              </Field>
              <Toggle label="TLS Verify'ı Atla (insecure)" checked={clEdit.insecure}
                onChange={(v) => setClEdit({ ...clEdit, insecure: v })} />
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={saveCl} disabled={saving}
                className="px-5 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm disabled:opacity-50">
                {saving ? "Kaydediliyor…" : "Kaydet"}
              </button>
              <button onClick={() => setClEdit(null)}
                className="px-5 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-sm">İptal</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="text-gray-600 font-medium block mb-1">{label}</span>
      {children}
    </label>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none text-sm">
      <div onClick={() => onChange(!checked)}
        className={`w-10 h-5 rounded-full transition-colors flex items-center px-0.5 ${checked ? "bg-blue-600" : "bg-gray-300"}`}>
        <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${checked ? "translate-x-5" : "translate-x-0"}`} />
      </div>
      <span className="text-gray-700">{label}</span>
    </label>
  );
}
