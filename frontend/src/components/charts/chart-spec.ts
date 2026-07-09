import type { ChartSpec } from "@/types/api";

export const CHART_PALETTE = ["#4f6ef7", "#a855f7", "#06b6d4", "#22c55e", "#f59e0b", "#ef4444"];

/** Map a backend ChartSpec to Plotly traces. */
export function specToTraces(spec: ChartSpec): Record<string, unknown>[] {
  const x = spec.x ?? [];
  switch (spec.type) {
    case "bar":
      return (spec.series ?? []).map((s, i) => ({
        x,
        y: s.values,
        name: s.name,
        type: "bar",
        marker: { color: CHART_PALETTE[i % CHART_PALETTE.length] },
      }));
    case "line":
    case "area":
      return (spec.series ?? []).map((s, i) => ({
        x,
        y: s.values,
        name: s.name,
        type: "scatter",
        mode: "lines",
        line: { color: CHART_PALETTE[i % CHART_PALETTE.length], width: 3, shape: "spline" },
        fill: spec.type === "area" ? "tozeroy" : undefined,
        connectgaps: false,
      }));
    case "scatter":
      return (spec.series ?? []).map((s, i) => ({
        x,
        y: s.values,
        name: s.name,
        type: "scatter",
        mode: "markers",
        marker: { color: CHART_PALETTE[i % CHART_PALETTE.length], size: 8 },
      }));
    case "pie":
      return [
        {
          labels: x,
          values: spec.series?.[0]?.values ?? [],
          type: "pie",
          hole: 0.45,
          marker: { colors: CHART_PALETTE },
          textinfo: "label+percent",
        },
      ];
    case "heatmap":
      return [
        {
          z: spec.z,
          x: spec.x_labels,
          y: spec.y_labels,
          type: "heatmap",
          colorscale: [
            [0, "#ef4444"],
            [0.5, "#f8fafc"],
            [1, "#4f6ef7"],
          ],
          zmin: -1,
          zmax: 1,
        },
      ];
    default:
      return [];
  }
}

export function specToLayout(spec: ChartSpec): Record<string, unknown> {
  return {
    showlegend: (spec.series?.length ?? 0) > 1 || spec.type === "pie",
    xaxis: spec.x_title ? { title: { text: spec.x_title } } : undefined,
    yaxis: spec.y_title ? { title: { text: spec.y_title } } : undefined,
    margin: { l: 52, r: 20, t: 10, b: 44 },
  };
}
