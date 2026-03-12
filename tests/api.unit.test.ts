import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type MockResponseOpts = {
  ok?: boolean;
  status?: number;
  statusText?: string;
  jsonBody?: unknown;
  textBody?: string;
};

function mockResponse(opts: MockResponseOpts = {}): Response {
  const status = opts.status ?? 200;
  const ok = opts.ok ?? (status >= 200 && status < 300);
  return {
    ok,
    status,
    statusText: opts.statusText ?? (ok ? "OK" : "Error"),
    json: async () => (opts.jsonBody ?? {}),
    text: async () => (opts.textBody ?? ""),
  } as Response;
}

async function importApi() {
  vi.resetModules();
  return import("@/lib/api");
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_API_URL = "http://api.local";
  process.env.NEXT_PUBLIC_OBSERVE_URL = "http://observe.local";
  process.env.NEXT_PUBLIC_ALARMFW_API_KEY = "unit-test-key";
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("lib/api unit", () => {
  it("sends API requests with X-API-Key header", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockResponse({ jsonBody: [] }));
    vi.stubGlobal("fetch", fetchMock);

    const api = await importApi();
    await api.getSecrets();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://api.local/api/secrets");
    const headers = init.headers as Headers;
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(headers.get("X-API-Key")).toBe("unit-test-key");
  });

  it("sends Observe requests to observe base URL with auth header", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      mockResponse({ jsonBody: { logged_in: false, has_token: false, has_prom_url: false } })
    );
    vi.stubGlobal("fetch", fetchMock);

    const api = await importApi();
    await api.getObserveAuth();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://observe.local/api/observe/auth");
    const headers = init.headers as Headers;
    expect(headers.get("X-API-Key")).toBe("unit-test-key");
  });

  it("encodes query parameters for getObserveEvents", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockResponse({ jsonBody: [] }));
    vi.stubGlobal("fetch", fetchMock);

    const api = await importApi();
    await api.getObserveEvents("cl us", "web/store", "pod 1", "Warning");

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    const u = new URL(url);
    expect(`${u.origin}${u.pathname}`).toBe("http://observe.local/api/observe/events");
    expect(u.searchParams.get("cluster")).toBe("cl us");
    expect(u.searchParams.get("namespace")).toBe("web/store");
    expect(u.searchParams.get("pod")).toBe("pod 1");
    expect(u.searchParams.get("type")).toBe("Warning");
  });

  it("sends empty config payload when triggerRun is called without config", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockResponse({ jsonBody: { ok: true, message: "Run started" } }));
    vi.stubGlobal("fetch", fetchMock);

    const api = await importApi();
    await api.triggerRun();

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("POST");
    expect(init.body).toBe("{}");
  });

  it("calls maintenance policy endpoint on getMaintenancePolicy", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockResponse({ jsonBody: { silences: [] } }));
    vi.stubGlobal("fetch", fetchMock);

    const api = await importApi();
    await api.getMaintenancePolicy();

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://api.local/api/policies/maintenance");
  });

  it("calls alarm metrics endpoint on getAlarmMetrics", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      mockResponse({ jsonBody: { rules_evaluated_total: 0, notifications_sent_total: 0 } })
    );
    vi.stubGlobal("fetch", fetchMock);

    const api = await importApi();
    await api.getAlarmMetrics();

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://api.local/api/alarms/metrics");
  });

  it("sends POST to create maintenance silence", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockResponse({ jsonBody: { ok: true, id: "sil-1" } }));
    vi.stubGlobal("fetch", fetchMock);

    const api = await importApi();
    await api.createMaintenanceSilence({
      starts_at_utc: "2026-03-12T01:00:00Z",
      ends_at_utc: "2026-03-12T02:00:00Z",
      namespace: "webstore",
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://api.local/api/policies/maintenance/silences");
    expect(init.method).toBe("POST");
  });

  it("sends POST to maintenance dry-run endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      mockResponse({ jsonBody: { ok: true, matched: 1, total_candidates: 2, matches: [] } })
    );
    vi.stubGlobal("fetch", fetchMock);

    const api = await importApi();
    await api.dryRunMaintenanceSilence(
      {
        starts_at_utc: "2026-03-12T01:00:00Z",
        ends_at_utc: "2026-03-12T02:00:00Z",
        cluster: "esy2-digital",
      },
      "2026-03-12T01:00:00Z"
    );

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://api.local/api/policies/maintenance/silences/dry-run");
    expect(init.method).toBe("POST");
  });

  it("calls policies audit endpoint with maintenance filter", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockResponse({ jsonBody: { entries: [], count: 0 } }));
    vi.stubGlobal("fetch", fetchMock);

    const api = await importApi();
    await api.getPolicyAudit("maintenance", 25);

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://api.local/api/policies/audit?policy=maintenance&limit=25");
  });

  it("calls policy versions endpoint with encoded query", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      mockResponse({ jsonBody: { policy: "maintenance", entries: [], count: 0 } })
    );
    vi.stubGlobal("fetch", fetchMock);

    const api = await importApi();
    await api.getPolicyVersions("maintenance", 10);

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://api.local/api/policies/versions?policy=maintenance&limit=10");
  });

  it("sends POST to policy rollback endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      mockResponse({ jsonBody: { ok: true, policy: "maintenance", rolled_back_from: "v-1", version_id: "v-2" } })
    );
    vi.stubGlobal("fetch", fetchMock);

    const api = await importApi();
    await api.rollbackPolicyVersion("maintenance", "v-1");

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://api.local/api/policies/rollback");
    expect(init.method).toBe("POST");
    expect(init.body).toBe('{\"policy\":\"maintenance\",\"version_id\":\"v-1\"}');
  });

  it("throws detailed error text for non-ok responses", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      mockResponse({ status: 401, statusText: "Unauthorized", textBody: "bad api key" })
    );
    vi.stubGlobal("fetch", fetchMock);

    const api = await importApi();
    await expect(api.getSecrets()).rejects.toThrow("401 Unauthorized: bad api key");
  });
});
