import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeDataset, renderWithProviders } from "@/test/test-utils";

vi.mock("@/lib/api", () => ({
  ApiError: class extends Error {},
  tokenStore: { access: null, refresh: null, set: vi.fn(), clear: vi.fn() },
  api: {
    datasets: { list: vi.fn(), get: vi.fn() },
    forecasts: { list: vi.fn(), get: vi.fn(), create: vi.fn(), remove: vi.fn() },
  },
}));

import ForecastsPage from "@/features/forecasts/forecasts-page";
import { api } from "@/lib/api";

const doneForecast = {
  id: "f1",
  dataset_id: "d1",
  target_column: "revenue",
  model_type: "sklearn_regression" as const,
  horizon_periods: 90,
  status: "done" as const,
  error_message: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  result: {
    model_used: "sklearn_regression",
    history: [100, 200, 300],
    forecast: [400, 500],
    lower: [350, 440],
    upper: [450, 560],
    confidence: 0.95,
    horizon_periods: 90,
    metrics: { r2: 0.97, mae: 12.5, rmse: 15.1 },
  },
};

describe("ForecastsPage workflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.datasets.list).mockResolvedValue([makeDataset({ id: "d1", name: "sales.csv" })]);
    vi.mocked(api.datasets.get).mockResolvedValue({
      ...makeDataset({ id: "d1" }),
      schema_snapshot: {
        columns: [
          { name: "revenue", dtype: "int64" },
          { name: "region", dtype: "object" },
        ],
      },
      quality_report: null,
    });
    vi.mocked(api.forecasts.list).mockResolvedValue([]);
    vi.mocked(api.forecasts.create).mockResolvedValue({
      ...doneForecast,
      status: "queued",
      result: null,
    } as never);
    vi.mocked(api.forecasts.get).mockResolvedValue(doneForecast);
  });

  it("runs a forecast and renders the CI chart with accuracy metrics", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ForecastsPage />);

    // numeric target column is auto-selected from the dataset schema
    await waitFor(() => expect(screen.getByRole("button", { name: /Run forecast/i })).toBeEnabled());
    await user.click(screen.getByRole("button", { name: /Run forecast/i }));

    await waitFor(() => expect(api.forecasts.create).toHaveBeenCalled());
    // detail view renders the done forecast (from forecasts.get)
    expect(await screen.findByText("R² (fit)")).toBeInTheDocument();
    expect(screen.getByText("0.970")).toBeInTheDocument();
    expect(screen.getByText(/Download CSV/)).toBeInTheDocument();
  });
});
