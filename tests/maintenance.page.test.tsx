import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import MaintenancePage from "@/app/maintenance/page";
import * as api from "@/lib/api";

vi.mock("@/lib/api", () => ({
  getMaintenancePolicy: vi.fn(),
  getPolicyAudit: vi.fn(),
  createMaintenanceSilence: vi.fn(),
  dryRunMaintenanceSilence: vi.fn(),
  deleteMaintenanceSilence: vi.fn(),
  updateMaintenancePolicy: vi.fn(),
}));

const mockedApi = vi.mocked(api);

describe("MaintenancePage smoke flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockedApi.getMaintenancePolicy.mockResolvedValue({
      silences: [
        {
          id: "s-1",
          enabled: true,
          cluster: "esy2-digital",
          namespace: "webstore",
          alarm_name: "",
          reason: "deploy",
          starts_at_utc: "2026-03-12T01:00:00Z",
          ends_at_utc: "2026-03-12T02:00:00Z",
          allow_recovery: false,
        },
      ],
    });
    mockedApi.getPolicyAudit.mockResolvedValue({ entries: [], count: 0 });
    mockedApi.createMaintenanceSilence.mockResolvedValue({ ok: true, id: "s-2" });
    mockedApi.deleteMaintenanceSilence.mockResolvedValue({ ok: true, id: "s-1" });
    mockedApi.updateMaintenancePolicy.mockResolvedValue({ ok: true, silences: 1 });
    mockedApi.dryRunMaintenanceSilence.mockResolvedValue({
      ok: true,
      active: true,
      evaluated_at_utc: "2026-03-12T01:00:00Z",
      total_candidates: 1,
      matched: 1,
      matches: [],
    });

    vi.stubGlobal("confirm", vi.fn(() => true));
  });

  it("creates, toggles and deletes a silence", async () => {
    render(<MaintenancePage />);

    await screen.findByText("s-1");

    fireEvent.change(screen.getByPlaceholderText("2026-03-12T01:00:00Z"), {
      target: { value: "2026-03-13T01:00:00Z" },
    });
    fireEvent.change(screen.getByPlaceholderText("2026-03-12T02:00:00Z"), {
      target: { value: "2026-03-13T02:00:00Z" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Ekle" }));

    await waitFor(() => {
      expect(mockedApi.createMaintenanceSilence).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole("button", { name: "Yes" }));
    await waitFor(() => {
      expect(mockedApi.updateMaintenancePolicy).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole("button", { name: "Sil" }));
    await waitFor(() => {
      expect(mockedApi.deleteMaintenanceSilence).toHaveBeenCalledWith("s-1");
    });
  });
});
