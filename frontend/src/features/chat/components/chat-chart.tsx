import { lazy, Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import type { ChartSpec } from "@/types/api";

// Plotly is heavy — lazy-load it so text-only chats never pay for it.
const PlotlyChart = lazy(() =>
  import("@/components/charts/plotly-chart").then((m) => ({ default: m.PlotlyChart })),
);

const PALETTE = ["#4f6ef7", "#a855f7", "#06b6d4", "#22c55e", "#f59e0b", "#ef4444"];

function toTraces(spec: ChartSpec): Record<string, unknown>[] {
  const x = spec.x ?? [];
  switch (spec.type) {
    case "bar":
      return (spec.series ?? []).map((s, i) => ({
        x,
        y: s.values,
        name: s.name,
        type: "bar",
        marker: { color: PALETTE[i % PALETTE.length] },
      }));
    case "line":
    case "area":
      return (spec.series ?? []).map((s, i) => ({
        x,
        y: s.values,
        name: s.name,
        type: "scatter",
        mode: "lines",
        line: { color: PALETTE[i % PALETTE.length], width: 3, shape: "spline" },
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
        marker: { color: PALETTE[i % PALETTE.length], size: 8 },
      }));
    case "pie":
      return [
        {
          labels: x,
          values: spec.series?.[0]?.values ?? [],
          type: "pie",
          hole: 0.45,
          marker: { colors: PALETTE },
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

export function ChatChart({ spec }: { spec: ChartSpec }) {
  const layout: Record<string, unknown> = {
    showlegend: (spec.series?.length ?? 0) > 1 || spec.type === "pie",
    xaxis: spec.x_title ? { title: { text: spec.x_title } } : undefined,
    yaxis: spec.y_title ? { title: { text: spec.y_title } } : undefined,
    margin: { l: 50, r: 20, t: 10, b: 44 },
  };

  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-border bg-card/60 p-3">
      {spec.title && <p className="mb-1 px-1 text-sm font-medium">{spec.title}</p>}
      <Suspense fallback={<Skeleton className="h-72 w-full rounded-lg" />}>
        <PlotlyChart data={toTraces(spec)} layout={layout} height={300} />
      </Suspense>
    </div>
  );
}
