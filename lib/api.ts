// Server-side: Docker iç ağı üzerinden (API_URL)
// Client-side: Tarayıcıdan doğrudan (NEXT_PUBLIC_API_URL)
const BASE =
  typeof window === "undefined"
    ? (process.env.API_URL ?? "http://alarmfw-api:8000")
    : (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000");

const OBSERVE_BASE =
  typeof window === "undefined"
    ? (process.env.OBSERVE_URL ?? "http://alarmfw-observe:8001")
    : (process.env.NEXT_PUBLIC_OBSERVE_URL ?? "http://localhost:8001");

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    ...init,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  return res.json();
}

// ── Alarms ────────────────────────────────────────────
export const getAlarms = (limit = 50, status?: string) =>
  req<Alarm[]>(`/api/alarms?limit=${limit}${status ? `&status=${status}` : ""}`);

export const getAlarmState = () => req<AlarmState[]>("/api/alarms/state");

export const clearOutbox = () =>
  req<{ deleted: number }>("/api/alarms/outbox", { method: "DELETE" });

// ── Checks ────────────────────────────────────────────
export const getChecks = () => req<Check[]>("/api/checks");
export const getCheck  = (name: string) => req<Check>(`/api/checks/${name}`);
export const updateCheck = (name: string, body: Check) =>
  req<{ ok: boolean }>(`/api/checks/${name}`, { method: "PUT", body: JSON.stringify(body) });
export const deleteCheck = (name: string) =>
  req<{ ok: boolean }>(`/api/checks/${name}`, { method: "DELETE" });

// ── Notifiers ─────────────────────────────────────────
export const getNotifiers = () => req<Record<string, Notifier>>("/api/notifiers");
export const updateNotifier = (name: string, body: Notifier) =>
  req<{ ok: boolean }>(`/api/notifiers/${name}`, { method: "PUT", body: JSON.stringify(body) });

// ── Secrets ───────────────────────────────────────────
export const getSecrets = () => req<Secret[]>("/api/secrets");
export const uploadSecretText = (cluster: string, token: string) =>
  req<{ ok: boolean }>(`/api/secrets/${cluster}/text`, {
    method: "PUT",
    body: JSON.stringify({ token }),
  });
export const deleteSecret = (cluster: string) =>
  req<{ ok: boolean }>(`/api/secrets/${cluster}`, { method: "DELETE" });

// ── Runner ────────────────────────────────────────────
export const triggerRun = (config?: string) =>
  req<{ ok: boolean; message: string }>("/api/run", {
    method: "POST",
    body: JSON.stringify(config ? { config } : {}),
  });
export const getLastRun = () => req<RunResult>("/api/run/last");

// ── Env ───────────────────────────────────────────────
export const getEnv = () => req<Record<string, string>>("/api/env");
export const updateEnv = (body: Record<string, string>) =>
  req<{ ok: boolean }>("/api/env", { method: "PUT", body: JSON.stringify(body) });

// ── Policies ──────────────────────────────────────────
export const getDedupPolicy = () => req<DedupPolicy>("/api/policies/dedup");
export const updateDedupPolicy = (body: DedupPolicy) =>
  req<{ ok: boolean }>("/api/policies/dedup", { method: "PUT", body: JSON.stringify(body) });

// ── Config (namespaces + clusters) ────────────────────
export const getNamespaces   = () => req<Namespace[]>("/api/config/namespaces");
export const getNamespace    = (name: string) => req<Namespace>(`/api/config/namespaces/${name}`);
export const upsertNamespace = (name: string, body: Namespace) =>
  req<{ ok: boolean; generated_checks: number }>(`/api/config/namespaces/${name}`, { method: "PUT", body: JSON.stringify(body) });
export const deleteNamespace = (name: string) =>
  req<{ ok: boolean }>(`/api/config/namespaces/${name}`, { method: "DELETE" });

export const getClusters   = () => req<Cluster[]>("/api/config/clusters");
export const upsertCluster = (name: string, body: Cluster) =>
  req<{ ok: boolean }>(`/api/config/clusters/${name}`, { method: "PUT", body: JSON.stringify(body) });
export const deleteCluster = (name: string) =>
  req<{ ok: boolean }>(`/api/config/clusters/${name}`, { method: "DELETE" });

export const generateConfig = () =>
  req<{ ok: boolean; generated_checks: number }>("/api/config/generate", { method: "POST" });

// ── Types ─────────────────────────────────────────────
export type Status = "OK" | "PROBLEM" | "ERROR";

export interface Alarm {
  alarm_name: string;
  status: Status;
  severity: string;
  message: string;
  timestamp_utc: string;
  dedup_key: string;
  evidence?: Record<string, unknown>;
  _filename?: string;
}

export interface AlarmState {
  dedup_key: string;
  last_status: string;
  last_sent_ts: number | null;
  last_change_ts: number | null;
}

export interface Check {
  name: string;
  type: string;
  enabled: boolean;
  params?: Record<string, string>;
  notify?: { primary: string[]; fallback: string[] };
  _source_file?: string;
}

export interface Notifier {
  type: string;
  [key: string]: unknown;
}

export interface Secret {
  name: string;
  cluster: string;
  size_bytes: number;
  modified: number;
}

export interface RunResult {
  status: "running" | "done" | "timeout" | "error" | "never_run";
  exit_code?: number;
  stdout?: string;
  stderr?: string;
  duration_sec?: number;
  config?: string;
  started_at?: number;
}

export interface DedupPolicy {
  repeat_interval_sec?: number;
  error_repeat_interval_sec?: number;
  recovery_notify?: boolean;
  recovery_cooldown_sec?: number;
}

export interface Namespace {
  name: string;
  namespace_enabled: boolean;
  clusters: string[];
  zabbix_enabled: boolean;
  mail_enabled: boolean;
  severity: string;
  node: string;
  department: string;
  alertkey: string;
  alertgroup: string;
  mail_to: string;
  mail_cc: string;
}

export interface Cluster {
  name: string;
  ocp_api: string;
  insecure: boolean;
  has_token_file?: boolean;
}

// ── Observe ───────────────────────────────────────────
async function obsReq<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${OBSERVE_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    ...init,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  return res.json();
}

export const getObserveClusters = () => obsReq<ObserveCluster[]>("/api/observe/clusters");

export const getObserveNamespaces = (cluster: string) =>
  obsReq<string[]>(`/api/observe/namespaces?cluster=${encodeURIComponent(cluster)}`);

export const getObservePods = (cluster: string, namespace: string) =>
  obsReq<ObservePod[]>(`/api/observe/pods?cluster=${encodeURIComponent(cluster)}&namespace=${encodeURIComponent(namespace)}`);

export const getObserveEvents = (cluster: string, namespace: string, pod?: string, type?: string) => {
  const q = new URLSearchParams({ cluster, namespace });
  if (pod)  q.set("pod", pod);
  if (type) q.set("type", type);
  return obsReq<ObserveEvent[]>(`/api/observe/events?${q.toString()}`);
};

export const runObservePromQL = (cluster: string, query: string, time?: string) =>
  obsReq<PromQLResult>("/api/observe/promql", {
    method: "POST",
    body: JSON.stringify({ cluster, query, ...(time ? { time } : {}) }),
  });

export interface ObserveCluster {
  name: string;
  ocp_api: string;
  insecure: boolean;
  prometheus_url: string;
  loki_url: string;
  prometheus_available: boolean;
  loki_available: boolean;
}

export interface ObservePod {
  name: string;
  namespace: string;
  phase: string;
  ready: string;
  containers: { name: string; image: string; ready: boolean; restarts: number }[];
  node: string | null;
  created_at: string | null;
  labels: Record<string, string>;
}

export interface ObserveEvent {
  type: string | null;
  reason: string | null;
  message: string | null;
  count: number | null;
  first_time: string | null;
  last_time: string | null;
  object: string | null;
  kind: string | null;
}

// ── Monitor ────────────────────────────────────────────
export const getMonitorPods = (params: { cluster?: string; namespace?: string }) => {
  const q = new URLSearchParams();
  if (params.cluster)   q.set("cluster", params.cluster);
  if (params.namespace) q.set("namespace", params.namespace);
  const qs = q.toString() ? `?${q.toString()}` : "";
  return req<MonitorSnapshot[]>(`/api/monitor/pods${qs}`);
};

export const getMonitorNamespaces = () => req<string[]>("/api/monitor/namespaces");
export const getMonitorClusters   = () => req<string[]>("/api/monitor/clusters");

export const runPromQL = (query: string, time?: string) =>
  req<PromQLResult>("/api/monitor/promql", {
    method: "POST",
    body: JSON.stringify({ query, ...(time ? { time } : {}) }),
  });

export interface PodInfo {
  pod: string;
  ready_str: string;
  restarts: number;
  phase: string;
  waiting?: string;
  terminated?: string;
  node?: string;
  image?: string;
  created_at?: string;
  workload?: string;
}

export interface MonitorSnapshot {
  namespace: string;
  cluster: string;
  status: string;
  timestamp_utc: string;
  pods: PodInfo[];
}

export interface PromQLResult {
  ok: boolean;
  error?: string;
  result: Array<{
    metric: Record<string, string>;
    value?: [number, string];
    values?: Array<[number, string]>;
  }>;
}
