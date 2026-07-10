import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/test-utils";
import type { Report } from "@/types/api";

vi.mock("@/lib/api", () => ({
  ApiError: class extends Error {},
  api: {
    users: { me: vi.fn().mockResolvedValue({ id: "u1", full_name: "Ada", role: "analyst" }) },
    datasets: { list: vi.fn().mockResolvedValue([]) },
    reports: {
      list: vi.fn(),
      get: vi.fn(),
      create: vi.fn(),
      remove: vi.fn(),
      downloadPdf: vi.fn(),
    },
  },
}));

import ReportsPage from "@/features/reports/reports-page";
import { api } from "@/lib/api";

function makeReport(overrides: Partial<Report> = {}): Report {
  return {
    id: crypto.randomUUID(),
    dataset_id: "d1",
    title: "Q3 Executive Report",
    storage_path: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

describe("ReportsPage workflow", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders reports returned by the API", async () => {
    vi.mocked(api.reports.list).mockResolvedValue([makeReport(), makeReport({ title: "Sales Deep Dive" })]);
    renderWithProviders(<ReportsPage />);
    expect(await screen.findByText("Q3 Executive Report")).toBeInTheDocument();
    expect(screen.getByText("Sales Deep Dive")).toBeInTheDocument();
  });

  it("shows an empty state when there are no reports", async () => {
    vi.mocked(api.reports.list).mockResolvedValue([]);
    renderWithProviders(<ReportsPage />);
    await waitFor(() => expect(screen.getByText("No reports yet")).toBeInTheDocument());
  });

  it("filters reports by search", async () => {
    vi.mocked(api.reports.list).mockResolvedValue([
      makeReport({ title: "Q3 Executive Report" }),
      makeReport({ title: "Sales Deep Dive" }),
    ]);
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    renderWithProviders(<ReportsPage />);
    await screen.findByText("Q3 Executive Report");
    await user.type(screen.getByPlaceholderText("Search reports…"), "sales");
    expect(screen.queryByText("Q3 Executive Report")).not.toBeInTheDocument();
    expect(screen.getByText("Sales Deep Dive")).toBeInTheDocument();
  });
});
