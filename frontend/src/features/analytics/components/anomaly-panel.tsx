import { AlertTriangle, ShieldCheck, Sparkles } from "lucide-react";
import { ChartFrame } from "@/components/charts/chart-frame";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import type { AnomalyItem, ChartSpec } from "@/types/api";

const SEVERITY: Record<AnomalyItem["severity"], "destructive" | "warning" | "secondary"> = {
  high: "destructive",
  medium: "warning",
  low: "secondary",
};

interface AnomalyPanelProps {
  items: AnomalyItem[];
  chart: ChartSpec | null;
  recommendations: string[];
}

export function AnomalyPanel({ items, chart, recommendations }: AnomalyPanelProps) {
  if (items.length === 0) {
    return (
      <div className="card-surface">
        <EmptyState icon={ShieldCheck} title="No anomalies detected" description="The numeric data is statistically consistent (IQR rule)." />
      </div>
    );
  }

  const totalOutliers = items.reduce((s, i) => s + i.count, 0);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-3">
        <div className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-soft">
          <div className="grid size-11 place-items-center rounded-xl bg-destructive/12 text-destructive">
            <AlertTriangle className="size-5" />
          </div>
          <div>
            <p className="text-2xl font-bold tabular-nums">{totalOutliers}</p>
            <p className="text-sm text-muted-foreground">outliers across {items.length} column(s)</p>
          </div>
        </div>

        {items.map((item) => (
          <div key={item.column} className="rounded-2xl border border-border bg-card p-4 shadow-soft">
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold">{item.column}</p>
              <Badge variant={SEVERITY[item.severity]} className="capitalize">
                {item.severity} severity
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{item.root_cause}</p>
            <div className="mt-2.5 flex flex-wrap gap-2 text-xs">
              <span className="rounded-lg bg-muted px-2 py-1">
                {item.count} outliers ({item.pct}%)
              </span>
              <span className="rounded-lg bg-muted px-2 py-1">
                bounds [{item.lower_bound}, {item.upper_bound}]
              </span>
              {item.extremes.length > 0 && (
                <span className="rounded-lg bg-destructive/10 px-2 py-1 text-destructive">
                  extremes: {item.extremes.join(", ")}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-4">
        {chart && <ChartFrame spec={chart} height={300} />}
        <div className="rounded-2xl border border-border bg-mesh p-4">
          <div className="mb-2 flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            <p className="text-sm font-semibold">AI recommendations</p>
          </div>
          <ul className="space-y-2">
            {recommendations.map((r, i) => (
              <li key={i} className="flex gap-2 rounded-xl border border-border bg-card/70 p-2.5 text-sm backdrop-blur">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                <span>{r.replace(/\*\*(.*?)\*\*/g, "$1")}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
