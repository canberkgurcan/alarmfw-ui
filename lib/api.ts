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

const API_KEY =
  typeof window === "undefined"
    ? (process.env.ALARMFW_API_KEY ?? "")
    : (process.env.NEXT_PUBLIC_ALARMFW_API_KEY ?? "");

const API_ACTOR =
  typeof window === "undefined"
    ? (process.env.ALARMFW_ACTOR ?? "")
    : (process.env.NEXT_PUBLIC_ALARMFW_ACTOR ?? "");

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers ?? {});
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (API_KEY && !headers.has("X-API-Key")) headers.set("X-API-Key", API_KEY);
  if (API_ACTOR && !headers.has("X-Actor")) headers.set("X-Actor", API_ACTOR);
  const res = await fetch(`${BASE}${path}`, {
    headers,
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

// ── Checks ────────────────────────────────────────────
export const getChecks = () => req<Check[]>("/api/checks");
export const updateCheck = (name: string, body: Check) =>
  req<{ ok: boolean }>(`/api/checks/${name}`, { method: "PUT", body: JSON.stringify(body) });
export const deleteCheck = (name: string) =>
  req<{ ok: boolean }>(`/api/checks/${name}`, { method: "DELETE" });

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

// ── Config (namespaces + clusters) ────────────────────
export const getNamespaces   = () => req<Namespace[]>("/api/config/namespaces");
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

export const getObserveClusterConfigs = () =>
  req<ObserveClusterConfig[]>("/api/config/observe-clusters");
export const upsertObserveCluster = (name: string, body: ObserveClusterConfig) =>
  req<{ ok: boolean }>(`/api/config/observe-clusters/${name}`, { method: "PUT", body: JSON.stringify(body) });
export const deleteObserveCluster = (name: string) =>
  req<{ ok: boolean }>(`/api/config/observe-clusters/${name}`, { method: "DELETE" });

// ── Policies / Maintenance ─────────────────────────────
export const getMaintenancePolicy = () =>
  req<MaintenancePolicy>("/api/policies/maintenance");

export const updateMaintenancePolicy = (body: MaintenancePolicy) =>
  req<{ ok: boolean; silences: number }>("/api/policies/maintenance", {
    method: "PUT",
    body: JSON.stringify(body),
  });

export const createMaintenanceSilence = (body: MaintenanceSilence) =>
  req<{ ok: boolean; id: string }>("/api/policies/maintenance/silences", {
    method: "POST",
    body: JSON.stringify(body),
  });

export const dryRunMaintenanceSilence = (silence: MaintenanceSilence, atUtc?: string) =>
  req<MaintenanceDryRunResult>("/api/policies/maintenance/silences/dry-run", {
    method: "POST",
    body: JSON.stringify(atUtc ? { silence, at_utc: atUtc } : { silence }),
  });

export const getPolicyAudit = (policy = "maintenance", limit = 50) =>
  req<PolicyAuditList>(
    `/api/policies/audit?policy=${encodeURIComponent(policy)}&limit=${encodeURIComponent(String(limit))}`
  );

export const deleteMaintenanceSilence = (id: string) =>
  req<{ ok: boolean; id: string }>(`/api/policies/maintenance/silences/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });

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
  alarm_name?: string | null;
}

export interface Check {
  name: string;
  type: string;
  enabled: boolean;
  params?: Record<string, string>;
  notify?: { primary: string[]; fallback: string[] };
  _source_file?: string;
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

export interface ObserveClusterConfig {
  name: string;
  ocp_api: string;
  insecure?: boolean;
  prometheus_url: string;
  prometheus_token_file?: string;
}

export interface MaintenanceSilence {
  id?: string;
  enabled?: boolean;
  alarm_name?: string;
  cluster?: string;
  namespace?: string;
  starts_at_utc: string;
  ends_at_utc: string;
  allow_recovery?: boolean;
  reason?: string;
}

export interface MaintenancePolicy {
  silences: MaintenanceSilence[];
}

export interface MaintenanceDryRunMatch {
  alarm_name: string;
  cluster: string;
  namespace: string;
  check_name: string;
  check_type: string;
  source_file: string;
}

export interface MaintenanceDryRunResult {
  ok: boolean;
  active: boolean;
  evaluated_at_utc: string;
  total_candidates: number;
  matched: number;
  matches: MaintenanceDryRunMatch[];
}

export interface PolicyAuditEntry {
  id: string;
  ts_utc: string;
  actor: string;
  client_ip?: string;
  policy: string;
  action: string;
  resource: string;
  summary: string;
  changes?: Record<string, unknown>;
}

export interface PolicyAuditList {
  entries: PolicyAuditEntry[];
  count: number;
}

// ── Observe ───────────────────────────────────────────
async function obsReq<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers ?? {});
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (API_KEY && !headers.has("X-API-Key")) headers.set("X-API-Key", API_KEY);
  if (API_ACTOR && !headers.has("X-Actor")) headers.set("X-Actor", API_ACTOR);
  const res = await fetch(`${OBSERVE_BASE}${path}`, {
    headers,
    cache: "no-store",
    ...init,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  return res.json();
}

export const getObserveAuth = () => obsReq<ObserveAuth>("/api/observe/auth");
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

export const getObserveAlerts = (cluster = "") =>
  obsReq<PromQLResult>(`/api/observe/alerts${cluster ? `?cluster=${encodeURIComponent(cluster)}` : ""}`);

export const getObserveNamespaceSummary = (cluster: string, namespace: string) =>
  obsReq<NamespaceSummary>(
    `/api/observe/namespace-summary?cluster=${encodeURIComponent(cluster)}&namespace=${encodeURIComponent(namespace)}`
  );

export const getObservePodMetrics = (pod: string, namespace: string, cluster = "") => {
  const q = new URLSearchParams({ pod, namespace });
  if (cluster) q.set("cluster", cluster);
  return obsReq<{ cpu: PromQLResult; memory: PromQLResult }>(`/api/observe/pod-metrics?${q.toString()}`);
};

// ── Health / Overview endpoints ───────────────────────────────────────────────

export const getHealthOverview = (cluster = "") =>
  obsReq<HealthOverview>(`/api/observe/health/overview?cluster=${encodeURIComponent(cluster)}`);

export const getHealthAlerts = (cluster = "") =>
  obsReq<HealthAlertsResult>(`/api/observe/health/alerts?cluster=${encodeURIComponent(cluster)}`);

export const getHealthNodes = (cluster = "") =>
  obsReq<HealthNodes>(`/api/observe/health/nodes?cluster=${encodeURIComponent(cluster)}`);

export const getHealthWorkload = (cluster = "") =>
  obsReq<HealthWorkload>(`/api/observe/health/workload?cluster=${encodeURIComponent(cluster)}`);

export const getHealthCapacity = (cluster = "") =>
  obsReq<HealthCapacity>(`/api/observe/health/capacity?cluster=${encodeURIComponent(cluster)}`);

export const getHealthControlPlane = (cluster = "") =>
  obsReq<HealthControlPlane>(`/api/observe/health/controlplane?cluster=${encodeURIComponent(cluster)}`);

// ── Health types ──────────────────────────────────────────────────────────────

export interface HealthOverview {
  ok: boolean;
  cluster: string;
  firing_alerts: number;
  crashloop: number;
  oomkilled: number;
  imagepull: number;
  pending_pods: number;
  notready_nodes: number;
  unavailable_deployments: number;
  failed_jobs: number;
}

export interface HealthAlert {
  metric: Record<string, string>;
  value?: [number, string];
  active_secs: number | null;
}

export interface HealthAlertsResult {
  ok: boolean;
  error?: string;
  result: HealthAlert[];
}

export interface HealthNodes {
  ok: boolean;
  errors?: Record<string, string>;
  notready: PromMetric[];
  pressure: PromMetric[];
  cpu: PromMetric[];
  memory: PromMetric[];
  disk: PromMetric[];
}

export interface HealthWorkload {
  ok: boolean;
  errors?: Record<string, string>;
  crashloop: PromMetric[];
  oomkilled: PromMetric[];
  imagepull: PromMetric[];
  pending: PromMetric[];
  unavailable: PromMetric[];
  failed_jobs: PromMetric[];
}

export interface HealthCapacity {
  ok: boolean;
  errors?: Record<string, string>;
  cpu_ratio: PromMetric[];
  cpu_abs: PromMetric[];
  quota_used: PromMetric[];
  quota_hard: PromMetric[];
  pvc_ratio: PromMetric[];
}

export interface HealthControlPlane {
  ok: boolean;
  errors?: Record<string, string>;
  etcd_db_size: PromMetric[];
  etcd_has_leader: PromMetric[];
  etcd_leader_changes: PromMetric[];
  apiserver_5xx_rate: PromMetric[];
  apiserver_p99: PromMetric[];
  cert_expiry_7d: PromMetric[];
}

export interface PromMetric {
  metric: Record<string, string>;
  value?: [number, string];
}

export interface NamespaceSummary {
  running: number;
  failed: number;
  pending: number;
  total_restarts: number;
  warning_events: number;
}

export interface ObserveAuth {
  logged_in: boolean;
  has_token: boolean;
  has_prom_url: boolean;
}

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

// ── Terminal ───────────────────────────────────────────
export const execTerminalCommand = (command: string) =>
  req<TerminalResult>("/api/terminal/exec", {
    method: "POST",
    body: JSON.stringify({ command }),
  });

export const getTerminalWhoami = () =>
  req<{ logged_in: boolean; user: string | null }>("/api/terminal/whoami");

export const getTerminalClusters = () =>
  req<{ name: string; ocp_api: string }[]>("/api/terminal/clusters");

export const terminalLogin = (cluster: string) =>
  req<TerminalResult>("/api/terminal/login", {
    method: "POST",
    body: JSON.stringify({ cluster }),
  });

export interface TerminalResult {
  ok: boolean;
  stdout: string;
  stderr: string;
  exit_code: number;
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

// ── Admin / Zabbix ────────────────────────────────────
export const getZabbixNamespaces = () =>
  req<ZabbixNamespace[]>("/api/admin/zabbix-namespaces");

export const sendZabbixEvent = (namespace: string, type: "1" | "2") =>
  req<ZabbixSendResult>("/api/admin/zabbix-send", {
    method: "POST",
    body: JSON.stringify({ namespace, type }),
  });

export interface ZabbixNamespace {
  name: string;
  severity: string;
  alertgroup: string;
  alertkey: string;
  node: string;
  department: string;
}

export interface ZabbixSendResult {
  ok: boolean;
  status_code?: number;
  response?: unknown;
  error?: string;
  payload: Record<string, string>;
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
