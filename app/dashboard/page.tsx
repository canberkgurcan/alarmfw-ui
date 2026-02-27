import { getAlarms, getAlarmState } from "@/lib/api";
import StatusBadge from "@/components/StatusBadge";

export const revalidate = 0;

export default async function DashboardPage() {
  const [alarms, state] = await Promise.all([
    getAlarms(100).catch(() => []),
    getAlarmState().catch(() => []),
  ]);

  const counts = { OK: 0, PROBLEM: 0, ERROR: 0 };
  for (const a of alarms) {
    if (a.status in counts) counts[a.status as keyof typeof counts]++;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {(["PROBLEM", "ERROR", "OK"] as const).map((s) => (
          <div key={s} className={`rounded-lg p-5 shadow-sm border
            ${s === "PROBLEM" ? "bg-red-50 border-red-200"
              : s === "ERROR" ? "bg-orange-50 border-orange-200"
              : "bg-green-50 border-green-200"}`}>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">{s}</p>
            <p className={`text-3xl font-bold
              ${s === "PROBLEM" ? "text-red-600"
                : s === "ERROR" ? "text-orange-600"
                : "text-green-600"}`}>
              {counts[s]}
            </p>
          </div>
        ))}
      </div>

      {/* Alarm table */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="font-semibold">Recent Alarms</h2>
          <span className="text-sm text-gray-400">{alarms.length} entries</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-gray-500 text-xs uppercase">
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Alarm</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Severity</th>
                <th className="px-4 py-3">Cluster</th>
                <th className="px-4 py-3">Namespace</th>
                <th className="px-4 py-3">Pods</th>
              </tr>
            </thead>
            <tbody>
              {alarms.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No alarms yet</td></tr>
              )}
              {alarms.map((a) => {
                const ev = (a.evidence ?? {}) as Record<string, unknown>;
                return (
                  <tr key={a._filename} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-400 whitespace-nowrap font-mono text-xs">
                      {a.timestamp_utc.replace("T", " ").replace("Z", "")}
                    </td>
                    <td className="px-4 py-3 font-medium max-w-xs truncate">{a.alarm_name}</td>
                    <td className="px-4 py-3"><StatusBadge status={a.status} /></td>
                    <td className="px-4 py-3 text-gray-600">{a.severity}</td>
                    <td className="px-4 py-3 text-gray-600">{String(ev.cluster ?? "—")}</td>
                    <td className="px-4 py-3 text-gray-600">{String(ev.namespace ?? "—")}</td>
                    <td className="px-4 py-3 text-gray-600">{ev.count != null ? String(ev.count) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* State table */}
      {state.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border mt-6">
          <div className="px-5 py-4 border-b">
            <h2 className="font-semibold">Dedup State</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-gray-500 text-xs uppercase">
                  <th className="px-4 py-3">Dedup Key</th>
                  <th className="px-4 py-3">Last Status</th>
                  <th className="px-4 py-3">Last Sent</th>
                  <th className="px-4 py-3">Last Change</th>
                </tr>
              </thead>
              <tbody>
                {state.map((s) => (
                  <tr key={s.dedup_key} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-2 font-mono text-xs text-gray-500">{s.dedup_key.slice(0, 16)}…</td>
                    <td className="px-4 py-2"><StatusBadge status={s.last_status} /></td>
                    <td className="px-4 py-2 text-gray-500 text-xs">
                      {s.last_sent_ts ? new Date(s.last_sent_ts * 1000).toISOString().replace("T"," ").slice(0,19) : "—"}
                    </td>
                    <td className="px-4 py-2 text-gray-500 text-xs">
                      {s.last_change_ts ? new Date(s.last_change_ts * 1000).toISOString().replace("T"," ").slice(0,19) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
