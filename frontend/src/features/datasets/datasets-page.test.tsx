import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeDataset, renderWithProviders } from "@/test/test-utils";

vi.mock("@/lib/api", () => {
  class ApiError extends Error {
    status = 0;
  }
  return {
    ApiError,
    tokenStore: { access: null, refresh: null, set: vi.fn(), clear: vi.fn() },
    api: {
      datasets: {
        list: vi.fn(),
        get: vi.fn(),
        preview: vi.fn(),
        statistics: vi.fn(),
        remove: vi.fn(),
        rename: vi.fn(),
        duplicate: vi.fn(),
        download: vi.fn(),
        cleanApply: vi.fn(),
        cleanUndo: vi.fn(),
        createUpload: vi.fn(),
      },
    },
  };
});

import DatasetsPage from "@/features/datasets/datasets-page";
import { api } from "@/lib/api";

describe("DatasetsPage (integration)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders datasets returned by the API", async () => {
    vi.mocked(api.datasets.list).mockResolvedValue([
      makeDataset({ name: "sales.csv" }),
      makeDataset({ name: "inventory.xlsx", source_type: "excel" }),
    ]);

    renderWithProviders(<DatasetsPage />);

    expect(await screen.findByText("sales.csv")).toBeInTheDocument();
    expect(screen.getByText("inventory.xlsx")).toBeInTheDocument();
  });

  it("shows an empty state when there are no datasets", async () => {
    vi.mocked(api.datasets.list).mockResolvedValue([]);

    renderWithProviders(<DatasetsPage />);

    await waitFor(() => expect(screen.getByText("No datasets yet")).toBeInTheDocument());
    expect(screen.getByText(/Upload your first dataset/)).toBeInTheDocument();
  });

  it("filters datasets by the search query", async () => {
    vi.mocked(api.datasets.list).mockResolvedValue([
      makeDataset({ name: "sales.csv" }),
      makeDataset({ name: "inventory.xlsx", source_type: "excel" }),
    ]);

    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    renderWithProviders(<DatasetsPage />);

    await screen.findByText("sales.csv");
    await user.type(screen.getByPlaceholderText("Search datasets…"), "invent");

    expect(screen.queryByText("sales.csv")).not.toBeInTheDocument();
    expect(screen.getByText("inventory.xlsx")).toBeInTheDocument();
  });
});
