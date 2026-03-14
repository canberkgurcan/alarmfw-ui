"use client";

import { useEffect, useMemo, useState } from "react";
import {
  createMaintenanceSilence,
  dryRunMaintenanceSilence,
  deleteMaintenanceSilence,
  getMaintenancePolicy,
  getPolicyAudit,
  updateMaintenancePolicy,
  type MaintenanceDryRunResult,
  type PolicyAuditEntry,
  type MaintenanceSilence,
} from "@/lib/api";

const EMPTY: MaintenanceSilence = {
  alarm_name: "",
  cluster: "",
  namespace: "",
  starts_at_utc: "",
  ends_at_utc: "",
  allow_recovery: false,
  reason: "",
};

export default function MaintenancePage() {
  const [silences, setSilences] = useState<MaintenanceSilence[]>([]);
  const [form, setForm] = useState<MaintenanceSilence>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [preview, setPreview] = useState<MaintenanceDryRunResult | null>(null);
  const [audit, setAudit] = useState<PolicyAuditEntry[]>([]);

  const sorted = useMemo(
    () =>
      [...silences].sort((a, b) =>
        String(a.starts_at_utc || "").localeCompare(String(b.starts_at_utc || ""))
      ),
    [silences]
  );

  async function load() {
    setLoading(true);
    setMsg("");
    setPreview(null);
    try {
      const [policy, history] = await Promise.all([
        getMaintenancePolicy(),
        getPolicyAudit("maintenance", 25),
      ]);
      setSilences(policy.silences || []);
      setAudit(history.entries || []);
    } catch (e: unknown) {
      setMsg(`Hata: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function validateWindow(startRaw: string, endRaw: string): string | null {
    if (!startRaw || !endRaw) return "Başlangıç ve bitiş UTC zorunlu.";
    const start = Date.parse(startRaw);
    const end = Date.parse(endRaw);
    if (Number.isNaN(start) || Number.isNaN(end)) return "Tarih formatı geçersiz. ISO UTC kullanın.";
    if (start >= end) return "Başlangıç tarihi bitişten önce olmalı.";
    return null;
  }

  async function previewNew() {
    const err = validateWindow(form.starts_at_utc, form.ends_at_utc);
    if (err) {
      setMsg(err);
      setPreview(null);
      return;
    }
    setLoading(true);
    setMsg("");
    try {
      const data = await dryRunMaintenanceSilence(form, form.starts_at_utc);
      setPreview(data);
      setMsg(`Önizleme tamamlandı: ${data.matched} alarm etkileniyor.`);
    } catch (e: unknown) {
      setPreview(null);
      setMsg(`Hata: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(false);
    }
  }

  async function saveNew() {
    const err = validateWindow(form.starts_at_utc, form.ends_at_utc);
    if (err) {
      setMsg(err);
      setPreview(null);
      return;
    }
    setLoading(true);
    setMsg("");
    try {
      await createMaintenanceSilence(form);
      setForm(EMPTY);
      setPreview(null);
      await load();
      setMsg("✓ Silence eklendi");
    } catch (e: unknown) {
      setMsg(`Hata: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(false);
    }
  }

  async function remove(id?: string) {
    if (!id) return;
    if (!confirm(`'${id}' silinsin mi?`)) return;
    setLoading(true);
    setMsg("");
    try {
      await deleteMaintenanceSilence(id);
      await load();
      setMsg(`Silindi: ${id}`);
    } catch (e: unknown) {
      setMsg(`Hata: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(false);
    }
  }

  async function toggleEnabled(id?: string) {
    if (!id) return;
    const next = silences.map((s) =>
      String(s.id) === String(id) ? { ...s, enabled: !s.enabled } : s
    );
    setLoading(true);
    setMsg("");
    try {
      await updateMaintenancePolicy({ silences: next });
      setSilences(next);
    } catch (e: unknown) {
      setMsg(`Hata: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Maintenance / Silence</h1>
        <p className="text-sm text-gray-500 mt-1">
          Aktif pencerelerde bildirimler susturulur. Alanlar boş bırakılırsa tüm alarm/cluster/namespace
          için geçerli olur.
        </p>
      </div>

      {msg && (
        <div className={`px-4 py-2 rounded text-sm ${msg.startsWith("Hata") ? "bg-red-50 text-red-700" : "bg-blue-50 text-blue-700"}`}>
          {msg}
        </div>
      )}

      {preview && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-2 text-sm">
          <div className="font-semibold text-amber-800">
            Dry-run: {preview.matched} / {preview.total_candidates} alarm eşleşti
          </div>
          <div className="text-amber-700 text-xs font-mono">
            evaluated_at_utc: {preview.evaluated_at_utc}
          </div>
          <div className="max-h-48 overflow-auto border rounded bg-white">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-amber-100 text-left">
                  <th className="px-3 py-2">Alarm</th>
                  <th className="px-3 py-2">Cluster</th>
                  <th className="px-3 py-2">Namespace</th>
                </tr>
              </thead>
              <tbody>
                {preview.matches.slice(0, 25).map((m) => (
                  <tr
                    key={`${m.alarm_name}|${m.cluster}|${m.namespace}|${m.source_file}`}
                    className="border-t"
                  >
                    <td className="px-3 py-2 font-mono">{m.alarm_name}</td>
                    <td className="px-3 py-2">{m.cluster || "*"}</td>
                    <td className="px-3 py-2">{m.namespace || "*"}</td>
                  </tr>
                ))}
                {preview.matches.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-3 py-3 text-gray-500">
                      Eşleşme yok
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg border p-5 space-y-4">
        <h2 className="font-semibold">Yeni Silence</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Alarm Name (opsiyonel)">
            <input
              value={form.alarm_name ?? ""}
              onChange={(e) => setForm({ ...form, alarm_name: e.target.value })}
              className="input"
              placeholder="ocp_pod_health__webstore__esy2-digital"
            />
          </Field>
          <Field label="Cluster (opsiyonel)">
            <input
              value={form.cluster ?? ""}
              onChange={(e) => setForm({ ...form, cluster: e.target.value })}
              className="input"
              placeholder="esy2-digital"
            />
          </Field>
          <Field label="Namespace (opsiyonel)">
            <input
              value={form.namespace ?? ""}
              onChange={(e) => setForm({ ...form, namespace: e.target.value })}
              className="input"
              placeholder="webstore"
            />
          </Field>
          <Field label="Reason (opsiyonel)">
            <input
              value={form.reason ?? ""}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              className="input"
              placeholder="planned deployment"
            />
          </Field>
          <Field label="Starts At UTC">
            <input
              value={form.starts_at_utc}
              onChange={(e) => setForm({ ...form, starts_at_utc: e.target.value })}
              className="input font-mono"
              placeholder="2026-03-12T01:00:00Z"
            />
          </Field>
          <Field label="Ends At UTC">
            <input
              value={form.ends_at_utc}
              onChange={(e) => setForm({ ...form, ends_at_utc: e.target.value })}
              className="input font-mono"
              placeholder="2026-03-12T02:00:00Z"
            />
          </Field>
        </div>
        <label className="inline-flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={!!form.allow_recovery}
            onChange={(e) => setForm({ ...form, allow_recovery: e.target.checked })}
            className="accent-blue-600"
          />
          Recovery bildirimlerine izin ver
        </label>
        <div className="flex items-center gap-2">
          <button
            onClick={previewNew}
            disabled={loading}
            className="px-4 py-2 rounded bg-amber-600 text-white text-sm hover:bg-amber-700 disabled:opacity-50"
          >
            Dry-run
          </button>
          <button
            onClick={saveNew}
            disabled={loading}
            className="px-4 py-2 rounded bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            Ekle
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="px-5 py-3 border-b font-semibold">Aktif Tanımlar</div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <th className="px-4 py-3">ID</th>
              <th className="px-4 py-3">Scope</th>
              <th className="px-4 py-3">Window (UTC)</th>
              <th className="px-4 py-3">Enabled</th>
              <th className="px-4 py-3">Reason</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  Tanımlı silence yok
                </td>
              </tr>
            )}
            {sorted.map((s) => (
              <tr key={String(s.id)} className="border-t">
                <td className="px-4 py-3 font-mono text-xs">{s.id}</td>
                <td className="px-4 py-3 text-xs">
                  <div>alarm: {s.alarm_name || "*"}</div>
                  <div>cluster: {s.cluster || "*"}</div>
                  <div>namespace: {s.namespace || "*"}</div>
                </td>
                <td className="px-4 py-3 text-xs font-mono">
                  <div>{s.starts_at_utc}</div>
                  <div>{s.ends_at_utc}</div>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => toggleEnabled(s.id)}
                    className={`px-2 py-1 rounded text-xs ${
                      s.enabled === false ? "bg-gray-100 text-gray-600" : "bg-green-100 text-green-700"
                    }`}
                  >
                    {s.enabled === false ? "No" : "Yes"}
                  </button>
                </td>
                <td className="px-4 py-3 text-xs text-gray-600">{s.reason || "—"}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => remove(s.id)}
                    className="px-3 py-1 rounded text-xs bg-red-50 text-red-600 hover:bg-red-100"
                  >
                    Sil
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="px-5 py-3 border-b font-semibold">Audit Log</div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <th className="px-4 py-3">Time (UTC)</th>
              <th className="px-4 py-3">Actor</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Resource</th>
              <th className="px-4 py-3">Summary</th>
            </tr>
          </thead>
          <tbody>
            {audit.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                  Audit kaydı yok
                </td>
              </tr>
            )}
            {audit.map((row) => (
              <tr key={row.id} className="border-t">
                <td className="px-4 py-3 text-xs font-mono">{row.ts_utc}</td>
                <td className="px-4 py-3 text-xs">{row.actor || "unknown"}</td>
                <td className="px-4 py-3 text-xs font-mono">{row.action}</td>
                <td className="px-4 py-3 text-xs font-mono">{row.resource}</td>
                <td className="px-4 py-3 text-xs text-gray-700">{row.summary || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="text-gray-600">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
