import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeDataset, renderWithProviders } from "@/test/test-utils";
import type { DatasetAnalytics } from "@/types/api";

vi.mock("@/lib/api", () => ({
  ApiError: class extends Error {},
  tokenStore: { access: null, refresh: null, set: vi.fn(), clear: vi.fn() },
  api: {
    datasets: { list: vi.fn(), analytics: vi.fn() },
  },
}));

import AnalyticsPage from "@/features/analytics/analytics-page";
import { api } from "@/lib/api";

const chart = (type: string) => ({ type, title: "c", x: ["A"], series: [{ name: "s", values: [1] }] });

const ANALYTICS: DatasetAnalytics = {
  primary_measure: "revenue",
  dimension: "region",
  date_column: "date",
  options: { measures: ["revenue", "orders"], dimensions: ["region", "product"], date_columns: ["date"] },
  kpis: { row_count: 12, column_count: 5, quality_score: 82, completeness: 98.5, numeric_count: 2, measures: [{ name: "revenue", total: 3520, mean: 293, min: 100, max: 900, is_primary: true }] },
  trend: { change_pct: 12.5, direction: "up", peak: { date: "2024-07-31", value: 900 }, chart: chart("area") as never },
  category_breakdown: { dimension: "region", measure: "revenue", rows: [{ name: "North", value: 1000, pct: 28 }], bar: chart("bar") as never, pie: chart("pie") as never },
  segmentation: { measure: "revenue", chart: chart("bar") as never },
  geographic: { column: "region", chart: chart("bar") as never },
  correlation: { chart: { type: "heatmap", title: "Correlation matrix", x_labels: ["revenue"], y_labels: ["revenue"], z: [[1]] } as never, top_pairs: [{ a: "revenue", b: "orders", value: 0.98 }] },
  distributions: {},
  missing_values: { columns: [{ name: "revenue", missing_count: 1, missing_pct: 8.3 }], duplicate_rows: 0 },
  anomalies: { items: [{ column: "revenue", count: 1, pct: 8.3, severity: "medium", lower_bound: 0, upper_bound: 500, extremes: [900], root_cause: "1 value outside range" }], chart: null, recommendations: ["Review revenue outliers"] },
  insights: { key_insights: ["12 records across 5 columns."], opportunities: ["Grow South"], risks: ["Concentration risk"], revenue_drivers: ["orders drives revenue"], growth_trends: ["revenue grew 12%"], recommendations: ["Proceed to forecasting"] },
};

describe("AnalyticsPage workflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.datasets.list).mockResolvedValue([makeDataset({ id: "d1", name: "sales.csv" })]);
    vi.mocked(api.datasets.analytics).mockResolvedValue(ANALYTICS);
  });

  it("auto-selects a dataset and renders KPIs, insights, and anomalies from real analytics", async () => {
    renderWithProviders(<AnalyticsPage />);

    // KPI derived from the bundle
    expect(await screen.findByText("82/100")).toBeInTheDocument();
    expect(screen.getByText("98.5%")).toBeInTheDocument();
    // insights + anomalies
    expect(screen.getByText("12 records across 5 columns.")).toBeInTheDocument();
    expect(screen.getByText("Anomaly detection")).toBeInTheDocument();
    expect(screen.getByText("Review revenue outliers")).toBeInTheDocument();
    await waitFor(() => expect(api.datasets.analytics).toHaveBeenCalledWith("d1", expect.anything()));
  });
});
