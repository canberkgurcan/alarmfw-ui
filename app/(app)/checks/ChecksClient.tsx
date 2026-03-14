"use client";
import { useState } from "react";
import type { Check } from "@/lib/api";
import { updateCheck, deleteCheck } from "@/lib/api";

export default function ChecksClient({ initial }: { initial: Check[] }) {
  const [checks, setChecks]   = useState(initial);
  const [editing, setEditing] = useState<Check | null>(null);
  const [saving, setSaving]   = useState(false);
  const [msg, setMsg]         = useState("");

  async function save() {
    if (!editing) return;
    setSaving(true);
    try {
      await updateCheck(editing.name, editing);
      setChecks((prev) => prev.map((c) => (c.name === editing.name ? editing : c)));
      setMsg("Saved ✓");
      setEditing(null);
    } catch (e: unknown) {
      setMsg(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSaving(false);
    }
  }

  async function remove(name: string) {
    if (!confirm(`Delete check "${name}"?`)) return;
    try {
      await deleteCheck(name);
      setChecks((prev) => prev.filter((c) => c.name !== name));
      setMsg(`Deleted "${name}"`);
    } catch (e: unknown) {
      setMsg(`Error: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Checks</h1>
      {msg && <div className="mb-4 text-sm px-4 py-2 rounded bg-blue-50 text-blue-700">{msg}</div>}

      <div className="bg-white rounded-lg shadow-sm border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left text-gray-500 text-xs uppercase border-b">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Enabled</th>
              <th className="px-4 py-3">Notifiers</th>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {checks.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No checks configured</td></tr>
            )}
            {checks.map((c) => (
              <tr key={c.name} className="border-t hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{c.name}</td>
                <td className="px-4 py-3">
                  <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs">{c.type}</span>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${c.enabled ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                    {c.enabled ? "Yes" : "No"}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">
                  {[...(c.notify?.primary ?? []), ...(c.notify?.fallback ?? [])].join(", ") || "—"}
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs font-mono">{c._source_file}</td>
                <td className="px-4 py-3 flex gap-2">
                  <button onClick={() => { setEditing({ ...c }); setMsg(""); }}
                    className="text-xs px-3 py-1 rounded bg-blue-50 text-blue-600 hover:bg-blue-100">Edit</button>
                  <button onClick={() => remove(c.name)}
                    className="text-xs px-3 py-1 rounded bg-red-50 text-red-600 hover:bg-red-100">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit Modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold mb-4">Edit: {editing.name}</h2>

            <div className="space-y-3">
              <label className="block text-sm">
                <span className="text-gray-600 font-medium">Enabled</span>
                <select value={editing.enabled ? "true" : "false"}
                  onChange={(e) => setEditing({ ...editing, enabled: e.target.value === "true" })}
                  className="mt-1 block w-full border rounded px-3 py-2 text-sm">
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </label>

              <label className="block text-sm">
                <span className="text-gray-600 font-medium">Primary Notifiers (comma-separated)</span>
                <input
                  value={(editing.notify?.primary ?? []).join(", ")}
                  onChange={(e) => setEditing({
                    ...editing,
                    notify: { ...editing.notify, primary: e.target.value.split(",").map((s) => s.trim()).filter(Boolean), fallback: editing.notify?.fallback ?? [] }
                  })}
                  className="mt-1 block w-full border rounded px-3 py-2 text-sm font-mono"
                />
              </label>

              <label className="block text-sm">
                <span className="text-gray-600 font-medium">Fallback Notifiers (comma-separated)</span>
                <input
                  value={(editing.notify?.fallback ?? []).join(", ")}
                  onChange={(e) => setEditing({
                    ...editing,
                    notify: { primary: editing.notify?.primary ?? [], fallback: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) }
                  })}
                  className="mt-1 block w-full border rounded px-3 py-2 text-sm font-mono"
                />
              </label>

              {editing.params && (
                <div>
                  <p className="text-gray-600 font-medium text-sm mb-2">Params</p>
                  <div className="space-y-2">
                    {Object.entries(editing.params).map(([k, v]) => (
                      <label key={k} className="flex items-center gap-2 text-sm">
                        <span className="w-48 text-gray-500 font-mono text-xs shrink-0">{k}</span>
                        <input value={v}
                          onChange={(e) => setEditing({ ...editing, params: { ...editing.params, [k]: e.target.value } })}
                          className="flex-1 border rounded px-2 py-1 text-sm font-mono"
                        />
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={save} disabled={saving}
                className="px-5 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm disabled:opacity-50">
                {saving ? "Saving…" : "Save"}
              </button>
              <button onClick={() => setEditing(null)}
                className="px-5 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-sm">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
