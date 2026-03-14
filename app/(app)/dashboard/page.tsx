import { getAlarms, getAlarmMetrics, getAlarmState } from "@/lib/api";
import StatusBadge from "@/components/StatusBadge";

export const revalidate = 0;

export default async function DashboardPage() {
  const [alarms, state, metrics] = await Promise.all([
    getAlarms(100).catch(() => []),
    getAlarmState().catch(() => []),
    getAlarmMetrics().catch(() => ({
      version: 1,
      updated_at_utc: "",
      rules_evaluated_total: 0,
      notifications_sent_total: 0,
      notifications_suppressed_total: 0,
      evaluation_count_total: 0,
      evaluation_latency_ms_last: 0,
      evaluation_latency_ms_sum: 0,
      evaluation_latency_ms_avg: 0,
      last_exit_code: 0,
    })),
  ]);

  // State'ten sayım (her alarm'ın güncel durumu)
  const counts = { OK: 0, PROBLEM: 0, ERROR: 0 };
  for (const s of state) {
    const st = s.last_status as keyof typeof counts;
    if (st in counts) counts[st]++;
  }

  const notifTotal = metrics.notifications_sent_total + metrics.notifications_suppressed_total;
  const suppressionPct =
    notifTotal > 0 ? Math.round((metrics.notifications_suppressed_total / notifTotal) * 100) : 0;
  const hasActiveIssues = counts.PROBLEM + counts.ERROR > 0;
  const alertHealth =
    hasActiveIssues && metrics.notifications_sent_total === 0
      ? { label: "Riskli", cls: "bg-red-50 text-red-700 border-red-200" }
      : metrics.evaluation_latency_ms_last > 5000
      ? { label: "Yavaş", cls: "bg-amber-50 text-amber-700 border-amber-200" }
      : { label: "Sağlıklı", cls: "bg-green-50 text-green-700 border-green-200" };

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

      {/* Runtime metrics */}
      <div className="bg-white rounded-lg shadow-sm border mb-6">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <h2 className="font-semibold">Alarm Pipeline Health</h2>
          <span className={`text-xs px-2 py-1 rounded border ${alertHealth.cls}`}>
            {alertHealth.label}
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 p-5">
          <MetricCard label="Rules Evaluated" value={String(metrics.rules_evaluated_total)} />
          <MetricCard label="Notifications Sent" value={String(metrics.notifications_sent_total)} />
          <MetricCard
            label="Notifications Suppressed"
            value={`${metrics.notifications_suppressed_total} (${suppressionPct}%)`}
          />
          <MetricCard label="Eval Latency Last" value={`${metrics.evaluation_latency_ms_last} ms`} />
          <MetricCard label="Eval Latency Avg" value={`${metrics.evaluation_latency_ms_avg} ms`} />
        </div>
        <div className="px-5 pb-4 text-xs text-gray-500 font-mono">
          updated_at_utc: {metrics.updated_at_utc || "—"} | last_exit_code: {metrics.last_exit_code}
        </div>
      </div>

      {/* Recent alarms from SQLite */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="font-semibold">Son Alarmlar</h2>
          <span className="text-sm text-gray-400">{alarms.length} kayıt</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-gray-500 text-xs uppercase">
                <th className="px-4 py-3">Zaman</th>
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
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Henüz alarm yok</td></tr>
              )}
              {alarms.map((a, i) => {
                const ev = (a.evidence ?? {}) as Record<string, unknown>;
                return (
                  <tr key={i} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-400 whitespace-nowrap font-mono text-xs">
                      {a.timestamp_utc?.replace("T", " ").replace("Z", "") ?? "—"}
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

      {/* Dedup State table */}
      {state.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border mt-6">
          <div className="px-5 py-4 border-b">
            <h2 className="font-semibold">Alarm Durumları</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-gray-500 text-xs uppercase">
                  <th className="px-4 py-3">Alarm</th>
                  <th className="px-4 py-3">Durum</th>
                  <th className="px-4 py-3">Son Bildirim</th>
                  <th className="px-4 py-3">Son Değişim</th>
                </tr>
              </thead>
              <tbody>
                {state.map((s) => (
                  <tr key={s.dedup_key} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-2 text-sm text-gray-700">
                      {s.alarm_name ?? (
                        <span className="font-mono text-xs text-gray-400">{s.dedup_key.slice(0, 20)}…</span>
                      )}
                    </td>
                    <td className="px-4 py-2"><StatusBadge status={s.last_status} /></td>
                    <td className="px-4 py-2 text-gray-500 text-xs">
                      {s.last_sent_ts ? new Date(s.last_sent_ts * 1000).toISOString().replace("T", " ").slice(0, 19) : "—"}
                    </td>
                    <td className="px-4 py-2 text-gray-500 text-xs">
                      {s.last_change_ts ? new Date(s.last_change_ts * 1000).toISOString().replace("T", " ").slice(0, 19) : "—"}
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

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-gray-50 p-3">
      <div className="text-[11px] uppercase tracking-wide text-gray-500">{label}</div>
      <div className="text-lg font-semibold text-gray-800 mt-1">{value}</div>
    </div>
  );
}
