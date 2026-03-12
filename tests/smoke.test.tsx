import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    className,
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

// ── StatusBadge ────────────────────────────────────────────────────────────

import StatusBadge from "@/components/StatusBadge";

describe("StatusBadge", () => {
  it.each([
    ["OK", "text-green-700"],
    ["PROBLEM", "text-red-700"],
    ["ERROR", "text-orange-700"],
  ] as const)("renders %s status with correct class", (status, cls) => {
    render(<StatusBadge status={status} />);
    const el = screen.getByText(status);
    expect(el).toBeInTheDocument();
    expect(el.className).toContain(cls);
  });

  it("renders unknown status with gray fallback", () => {
    render(<StatusBadge status="PENDING" />);
    const el = screen.getByText("PENDING");
    expect(el).toBeInTheDocument();
    expect(el.className).toContain("text-gray-600");
  });
});

// ── Sidebar ────────────────────────────────────────────────────────────────

import Sidebar from "@/components/Sidebar";

describe("Sidebar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders brand name", () => {
    render(<Sidebar />);
    expect(screen.getByText("AlarmFW")).toBeInTheDocument();
  });

  it("renders top nav links", () => {
    render(<Sidebar />);
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Monitor")).toBeInTheDocument();
    expect(screen.getByText("Observe")).toBeInTheDocument();
  });

  it("renders Manage toggle button", () => {
    render(<Sidebar />);
    expect(screen.getByText("Manage")).toBeInTheDocument();
  });

  it("Manage section is collapsed by default on non-manage path", () => {
    render(<Sidebar />);
    expect(screen.queryByText("Checks")).not.toBeInTheDocument();
    expect(screen.queryByText("Secrets")).not.toBeInTheDocument();
  });

  it("clicking Manage reveals sub-navigation items", () => {
    render(<Sidebar />);
    const manageBtn = screen.getByText("Manage").closest("button")!;
    fireEvent.click(manageBtn);
    expect(screen.getByText("Checks")).toBeInTheDocument();
    expect(screen.getByText("Config")).toBeInTheDocument();
    expect(screen.getByText("Maintenance")).toBeInTheDocument();
    expect(screen.getByText("Run")).toBeInTheDocument();
    expect(screen.getByText("Secrets")).toBeInTheDocument();
    expect(screen.getByText("Admin Console")).toBeInTheDocument();
  });

  it("clicking Manage twice collapses the section again", () => {
    render(<Sidebar />);
    const manageBtn = screen.getByText("Manage").closest("button")!;
    fireEvent.click(manageBtn);
    expect(screen.getByText("Checks")).toBeInTheDocument();
    fireEvent.click(manageBtn);
    expect(screen.queryByText("Checks")).not.toBeInTheDocument();
  });
});

// ── API module exports ─────────────────────────────────────────────────────

describe("API module", () => {
  it("exports all expected functions", async () => {
    const api = await import("@/lib/api");
    const expected = [
      // Alarms
      "getAlarms",
      "getAlarmState",
      // Checks
      "getChecks",
      "updateCheck",
      "deleteCheck",
      // Secrets
      "getSecrets",
      "uploadSecretText",
      "deleteSecret",
      // Runner
      "triggerRun",
      "getLastRun",
      // Config
      "getNamespaces",
      "upsertNamespace",
      "deleteNamespace",
      "getClusters",
      "upsertCluster",
      "deleteCluster",
      "generateConfig",
      "getObserveClusterConfigs",
      "upsertObserveCluster",
      "deleteObserveCluster",
      // Observe
      "getObserveAuth",
      "getObserveClusters",
      "getObserveNamespaces",
      "getObservePods",
      "getObserveEvents",
      "runObservePromQL",
      "getObserveAlerts",
      "getObserveNamespaceSummary",
      "getObservePodMetrics",
      // Health
      "getHealthOverview",
      "getHealthAlerts",
      "getHealthNodes",
      "getHealthWorkload",
      "getHealthCapacity",
      "getHealthControlPlane",
      // Terminal
      "execTerminalCommand",
      "getTerminalWhoami",
      "getTerminalClusters",
      "terminalLogin",
      // Monitor
      "getMonitorPods",
      "getMonitorNamespaces",
      "getMonitorClusters",
      // Admin
      "getZabbixNamespaces",
      "sendZabbixEvent",
    ];

    for (const fn of expected) {
      expect(
        typeof (api as Record<string, unknown>)[fn],
        `${fn} should be exported as a function`
      ).toBe("function");
    }
  });
});
