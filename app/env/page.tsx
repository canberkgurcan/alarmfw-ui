"use client";
import { useState, useEffect } from "react";
import { getEnv, updateEnv } from "@/lib/api";

export default function EnvPage() {
  const [env, setEnv]       = useState<Record<string, string>>({});
  const [edits, setEdits]   = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg]       = useState("");

  useEffect(() => {
    getEnv().then((d) => { setEnv(d); setEdits(d); }).catch(() => {});
  }, []);

  async function save() {
    setSaving(true);
    try {
      await updateEnv(edits);
      setEnv({ ...edits });
      setMsg("Saved ✓");
    } catch (e: unknown) {
      setMsg(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSaving(false);
    }
  }

  const groups: Record<string, string[]> = {};
  for (const k of Object.keys(edits)) {
    if (k.startsWith("OCP_API_")) continue; // Config/Clusters tabında yönetiliyor
    const prefix = k.includes("_") ? k.split("_")[0] : "OTHER";
    if (!groups[prefix]) groups[prefix] = [];
    groups[prefix].push(k);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Environment</h1>
      {msg && <div className="mb-4 px-4 py-2 rounded bg-blue-50 text-blue-700 text-sm">{msg}</div>}

      <div className="space-y-6">
        {Object.entries(groups).map(([prefix, keys]) => (
          <div key={prefix} className="bg-white rounded-lg shadow-sm border">
            <div className="px-5 py-3 border-b bg-gray-50">
              <span className="font-semibold text-sm text-gray-600">{prefix}</span>
            </div>
            <div className="p-5 space-y-3">
              {keys.map((k) => (
                <label key={k} className="flex items-center gap-3 text-sm">
                  <span className="w-64 font-mono text-xs text-gray-500 shrink-0">{k}</span>
                  <input
                    type={edits[k] === "***" ? "password" : "text"}
                    value={edits[k] ?? ""}
                    onChange={(e) => setEdits({ ...edits, [k]: e.target.value })}
                    className="flex-1 border rounded px-3 py-1.5 text-sm font-mono"
                    placeholder={edits[k] === "***" ? "(masked — leave as *** to keep)" : ""}
                  />
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      {Object.keys(edits).length > 0 && (
        <div className="mt-6">
          <button onClick={save} disabled={saving}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50">
            {saving ? "Saving…" : "Save All"}
          </button>
        </div>
      )}
    </div>
  );
}
