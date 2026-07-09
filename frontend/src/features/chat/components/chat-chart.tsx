import { lazy, Suspense } from "react";
import { specToLayout, specToTraces } from "@/components/charts/chart-spec";
import { Skeleton } from "@/components/ui/skeleton";
import type { ChartSpec } from "@/types/api";

// Plotly is heavy — lazy-load it so text-only chats never pay for it.
const PlotlyChart = lazy(() =>
  import("@/components/charts/plotly-chart").then((m) => ({ default: m.PlotlyChart })),
);

export function ChatChart({ spec }: { spec: ChartSpec }) {
  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-border bg-card/60 p-3">
      {spec.title && <p className="mb-1 px-1 text-sm font-medium">{spec.title}</p>}
      <Suspense fallback={<Skeleton className="h-72 w-full rounded-lg" />}>
        <PlotlyChart data={specToTraces(spec)} layout={specToLayout(spec)} height={300} />
      </Suspense>
    </div>
  );
}
