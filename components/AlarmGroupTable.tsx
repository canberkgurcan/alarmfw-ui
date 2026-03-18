"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge, Button, Table, Tag, Typography } from "antd";
import { ArrowRightOutlined, CaretDownOutlined, CaretRightOutlined } from "@ant-design/icons";
import type { Alarm, AlarmState } from "@/lib/api";

const { Text } = Typography;

interface GroupRow {
  key: string;
  alarm_name: string;
  current_status: string;
  last_change_ts: number | null;
  events: Alarm[];
}

function statusColor(s: string) {
  if (s === "PROBLEM") return "error";
  if (s === "ERROR") return "warning";
  if (s === "OK") return "success";
  return "default";
}

function statusTag(s: string) {
  const color =
    s === "PROBLEM" ? "red" : s === "ERROR" ? "orange" : s === "OK" ? "green" : "default";
  return <Tag color={color}>{s}</Tag>;
}

function fmtTs(ts: number | null) {
  if (!ts) return "—";
  return new Date(ts * 1000).toISOString().replace("T", " ").slice(0, 19);
}

function fmtUtc(utc: string | null | undefined) {
  if (!utc) return "—";
  return utc.replace("T", " ").replace("Z", "").slice(0, 19);
}

function buildGroups(alarms: Alarm[], state: AlarmState[]): GroupRow[] {
  const alarmsByName: Record<string, Alarm[]> = {};
  for (const a of alarms) {
    if (!alarmsByName[a.alarm_name]) alarmsByName[a.alarm_name] = [];
    alarmsByName[a.alarm_name].push(a);
  }

  // alarm_name bazında dedup — aynı isimde birden fazla state entry olabilir (farklı dedup_key)
  // en son değişeni tut
  const stateByName: Record<string, AlarmState> = {};
  for (const s of state) {
    const name = s.alarm_name ?? s.dedup_key;
    const existing = stateByName[name];
    if (!existing || (s.last_change_ts ?? 0) > (existing.last_change_ts ?? 0)) {
      stateByName[name] = s;
    }
  }

  const rows: GroupRow[] = [];

  for (const [name, s] of Object.entries(stateByName)) {
    rows.push({
      key: name,
      alarm_name: name,
      current_status: s.last_status,
      last_change_ts: s.last_change_ts,
      events: alarmsByName[name] ?? [],
    });
  }

  for (const [name, events] of Object.entries(alarmsByName)) {
    if (stateByName[name]) continue;
    rows.push({
      key: name,
      alarm_name: name,
      current_status: events[0]?.status ?? "OK",
      last_change_ts: null,
      events,
    });
  }

  // PROBLEM + ERROR önce, sonra alarm_name sıralı
  return rows.sort((a, b) => {
    const rank = (s: string) => (s === "PROBLEM" ? 0 : s === "ERROR" ? 1 : 2);
    const r = rank(a.current_status) - rank(b.current_status);
    return r !== 0 ? r : a.alarm_name.localeCompare(b.alarm_name);
  });
}

function ExpandedEvents({ events }: { events: Alarm[] }) {
  if (events.length === 0) {
    return <Text type="secondary" style={{ padding: "8px 16px", display: "block" }}>Olay kaydı yok</Text>;
  }

  return (
    <div style={{ padding: "4px 16px 12px 40px" }}>
      <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ color: "#8c939d", borderBottom: "1px solid #f0f0f0" }}>
            <th style={{ textAlign: "left", padding: "6px 8px", fontWeight: 500 }}>Zaman</th>
            <th style={{ textAlign: "left", padding: "6px 8px", fontWeight: 500 }}>Cluster</th>
            <th style={{ textAlign: "left", padding: "6px 8px", fontWeight: 500 }}>Namespace</th>
            <th style={{ textAlign: "left", padding: "6px 8px", fontWeight: 500 }}>Durum</th>
            <th style={{ textAlign: "left", padding: "6px 8px", fontWeight: 500 }}>Pods</th>
            <th style={{ padding: "6px 8px" }} />
          </tr>
        </thead>
        <tbody>
          {events.map((e, i) => {
            const ev = (e.evidence ?? {}) as Record<string, unknown>;
            const cluster = String(ev.cluster ?? "");
            const namespace = String(ev.namespace ?? "");
            const monitorHref = `/monitor${cluster ? `?cluster=${encodeURIComponent(cluster)}` : ""}`;
            return (
              <tr key={i} style={{ borderBottom: "1px solid #fafafa" }}>
                <td style={{ padding: "5px 8px", fontFamily: "monospace", color: "#667085" }}>
                  {fmtUtc(e.timestamp_utc)}
                </td>
                <td style={{ padding: "5px 8px", color: "#344054" }}>{cluster || "—"}</td>
                <td style={{ padding: "5px 8px", color: "#344054" }}>{namespace || "—"}</td>
                <td style={{ padding: "5px 8px" }}>{statusTag(e.status)}</td>
                <td style={{ padding: "5px 8px", color: "#667085" }}>
                  {ev.count != null ? String(ev.count) : "—"}
                </td>
                <td style={{ padding: "5px 8px", textAlign: "right" }}>
                  <Link href={monitorHref}>
                    <Button size="small" type="link" icon={<ArrowRightOutlined />}>
                      Monitor
                    </Button>
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function AlarmGroupTable({
  alarms,
  state,
}: {
  alarms: Alarm[];
  state: AlarmState[];
}) {
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
  const rows = buildGroups(alarms, state);

  const toggle = (key: string) =>
    setExpandedKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );

  if (rows.length === 0) {
    return (
      <Text type="secondary" style={{ display: "block", padding: "24px", textAlign: "center" }}>
        Henüz alarm yok
      </Text>
    );
  }

  return (
    <div>
      {rows.map((row) => {
        const isOpen = expandedKeys.includes(row.key);
        return (
          <div key={row.key} style={{ borderBottom: "1px solid #f0f0f0" }}>
            {/* Group header row */}
            <div
              onClick={() => toggle(row.key)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 16px",
                cursor: "pointer",
                background: isOpen ? "#fafbff" : "transparent",
                transition: "background 0.15s",
              }}
            >
              <span style={{ color: "#8c939d", fontSize: 12, width: 12, flexShrink: 0 }}>
                {isOpen ? <CaretDownOutlined /> : <CaretRightOutlined />}
              </span>

              <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: "#1a2035", wordBreak: "break-all" }}>
                {row.alarm_name}
              </span>

              {statusTag(row.current_status)}

              {row.events.length > 0 && (
                <Badge
                  count={row.events.length}
                  color={statusColor(row.current_status) === "error" ? "#ef4444" : statusColor(row.current_status) === "warning" ? "#f59e0b" : "#6b7280"}
                  style={{ fontSize: 10 }}
                />
              )}

              <Text type="secondary" style={{ fontSize: 11, whiteSpace: "nowrap", marginLeft: 8 }}>
                {fmtTs(row.last_change_ts)}
              </Text>
            </div>

            {/* Expanded events */}
            {isOpen && <ExpandedEvents events={row.events} />}
          </div>
        );
      })}
    </div>
  );
}
