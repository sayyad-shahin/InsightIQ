import { AlertCircle, CheckCircle2, Table2 } from "lucide-react";
import { PlotlyChart } from "@/components/charts/plotly-chart";
import { EmptyState } from "@/components/shared/empty-state";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { QualityRing } from "@/features/datasets/components/quality-ring";
import { useDataset, useDatasetPreview, useDatasetStatistics } from "@/features/datasets/hooks";
import { formatNumber } from "@/lib/utils";
import type { Dataset, Distribution, QualityReport } from "@/types/api";

interface Props {
  dataset: Dataset | null;
  onOpenChange: (open: boolean) => void;
}

export function DatasetPreviewDialog({ dataset, onOpenChange }: Props) {
  const id = dataset?.id;
  const open = !!dataset;
  const previewQ = useDatasetPreview(id, open);
  const statsQ = useDatasetStatistics(id, open);
  const detailQ = useDataset(open ? id : undefined);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl gap-4 p-0">
        <DialogHeader className="border-b border-border p-5">
          <DialogTitle className="truncate">{dataset?.name}</DialogTitle>
          <DialogDescription>
            {dataset && `${formatNumber(dataset.row_count)} rows · ${dataset.column_count ?? "—"} columns`}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="data" className="px-5 pb-5">
          <TabsList>
            <TabsTrigger value="data">Data</TabsTrigger>
            <TabsTrigger value="stats">Statistics</TabsTrigger>
            <TabsTrigger value="quality">Quality</TabsTrigger>
            <TabsTrigger value="correlation">Correlation</TabsTrigger>
          </TabsList>

          {/* DATA */}
          <TabsContent value="data">
            {previewQ.isLoading ? (
              <Skeleton className="h-80 w-full rounded-xl" />
            ) : previewQ.data ? (
              <ScrollArea className="h-[420px] rounded-xl border border-border">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-card">
                    <tr className="border-b border-border">
                      {previewQ.data.columns.map((c) => (
                        <th key={c} className="whitespace-nowrap px-3 py-2 text-left font-semibold">
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewQ.data.rows.map((row, i) => (
                      <tr key={i} className="border-b border-border/50 last:border-0">
                        {previewQ.data!.columns.map((c) => (
                          <td key={c} className="max-w-[220px] truncate px-3 py-1.5 text-muted-foreground">
                            {formatCell(row[c])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollArea>
            ) : (
              <EmptyState
                icon={Table2}
                title="Preview unavailable"
                description="This dataset can't be previewed."
              />
            )}
          </TabsContent>

          {/* STATISTICS */}
          <TabsContent value="stats">
            {statsQ.isLoading ? (
              <Skeleton className="h-80 w-full rounded-xl" />
            ) : statsQ.data ? (
              <div className="space-y-5">
                <div className="flex flex-wrap items-center gap-6 rounded-xl border border-border p-4">
                  <QualityRing score={statsQ.data.quality_score} />
                  <div className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-3">
                    <MiniStat label="Rows" value={formatNumber(statsQ.data.row_count)} />
                    <MiniStat label="Columns" value={String(statsQ.data.column_count)} />
                    <MiniStat
                      label="Numeric cols"
                      value={String(Object.keys(statsQ.data.statistics).length)}
                    />
                  </div>
                </div>

                {Object.keys(statsQ.data.statistics).length > 0 ? (
                  <ScrollArea className="max-h-[280px] rounded-xl border border-border">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-card text-xs uppercase text-muted-foreground">
                        <tr className="border-b border-border">
                          {["Column", "Mean", "Std", "Min", "Median", "Max"].map((h) => (
                            <th key={h} className="px-3 py-2 text-left font-medium">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(statsQ.data.statistics).map(([col, s]) => (
                          <tr key={col} className="border-b border-border/50 last:border-0">
                            <td className="px-3 py-1.5 font-medium">{col}</td>
                            <td className="px-3 py-1.5 tabular-nums text-muted-foreground">{s.mean}</td>
                            <td className="px-3 py-1.5 tabular-nums text-muted-foreground">{s.std}</td>
                            <td className="px-3 py-1.5 tabular-nums text-muted-foreground">{s.min}</td>
                            <td className="px-3 py-1.5 tabular-nums text-muted-foreground">{s.median}</td>
                            <td className="px-3 py-1.5 tabular-nums text-muted-foreground">{s.max}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </ScrollArea>
                ) : (
                  <p className="text-sm text-muted-foreground">No numeric columns to summarize.</p>
                )}

                <Distributions distributions={statsQ.data.distributions} />
              </div>
            ) : null}
          </TabsContent>

          {/* QUALITY */}
          <TabsContent value="quality">
            {detailQ.isLoading ? (
              <Skeleton className="h-64 w-full rounded-xl" />
            ) : detailQ.data?.quality_report ? (
              <QualityReportView report={detailQ.data.quality_report} />
            ) : (
              <EmptyState icon={AlertCircle} title="No quality report" />
            )}
          </TabsContent>

          {/* CORRELATION */}
          <TabsContent value="correlation">
            {statsQ.isLoading ? (
              <Skeleton className="h-80 w-full rounded-xl" />
            ) : statsQ.data?.correlation ? (
              <div className="rounded-xl border border-border p-3">
                <PlotlyChart
                  height={400}
                  data={[
                    {
                      z: statsQ.data.correlation.matrix,
                      x: statsQ.data.correlation.columns,
                      y: statsQ.data.correlation.columns,
                      type: "heatmap",
                      colorscale: [
                        [0, "#ef4444"],
                        [0.5, "#f8fafc"],
                        [1, "#4f6ef7"],
                      ],
                      zmin: -1,
                      zmax: 1,
                      hovertemplate: "%{x} · %{y}: %{z}<extra></extra>",
                    },
                  ]}
                />
              </div>
            ) : (
              <EmptyState
                icon={Table2}
                title="Not enough numeric columns"
                description="Correlation needs at least two numeric columns."
              />
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "number") return String(value);
  return String(value);
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/40 p-3">
      <p className="text-lg font-bold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function Distributions({ distributions }: { distributions: Record<string, Distribution> }) {
  const entries = Object.entries(distributions).slice(0, 4);
  if (entries.length === 0) return null;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {entries.map(([col, dist]) => (
        <div key={col} className="rounded-xl border border-border p-3">
          <p className="mb-2 truncate text-sm font-medium">{col}</p>
          <DistributionBars dist={dist} />
        </div>
      ))}
    </div>
  );
}

function DistributionBars({ dist }: { dist: Distribution }) {
  const bars =
    dist.type === "numeric"
      ? dist.bins.map((b) => ({ label: `${b.start}`, count: b.count }))
      : dist.values.map((v) => ({ label: v.value, count: v.count }));
  const max = Math.max(...bars.map((b) => b.count), 1);
  return (
    <div className="space-y-1">
      {bars.map((b, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-16 shrink-0 truncate text-xs text-muted-foreground">{b.label}</span>
          <div className="h-3 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-brand-gradient"
              style={{ width: `${(b.count / max) * 100}%` }}
            />
          </div>
          <span className="w-8 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
            {b.count}
          </span>
        </div>
      ))}
    </div>
  );
}

function QualityReportView({ report }: { report: QualityReport }) {
  const missing = Object.entries(report.missing_values);
  const outliers = Object.entries(report.outliers);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <MiniStat label="Total rows" value={formatNumber(report.total_rows)} />
        <MiniStat label="Duplicate rows" value={formatNumber(report.duplicate_rows)} />
        <MiniStat label="Cols w/ missing" value={String(missing.length)} />
      </div>

      <div className="rounded-xl border border-border p-4">
        <p className="mb-2 text-sm font-semibold">Suggestions</p>
        <ul className="space-y-1.5">
          {report.suggestions.map((s, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
              {s}
            </li>
          ))}
        </ul>
      </div>

      {missing.length > 0 && (
        <div className="rounded-xl border border-border p-4">
          <p className="mb-2 text-sm font-semibold">Missing values</p>
          <div className="space-y-1.5">
            {missing.map(([col, info]) => (
              <div key={col} className="flex items-center gap-2 text-sm">
                <span className="w-32 shrink-0 truncate">{col}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-warning" style={{ width: `${info.missing_pct}%` }} />
                </div>
                <span className="w-16 shrink-0 text-right text-xs text-muted-foreground">
                  {info.missing_count} ({info.missing_pct}%)
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {outliers.length > 0 && (
        <div className="rounded-xl border border-border p-4">
          <p className="mb-2 text-sm font-semibold">Outliers (IQR)</p>
          <div className="flex flex-wrap gap-2">
            {outliers.map(([col, count]) => (
              <span key={col} className="rounded-lg bg-muted px-2.5 py-1 text-xs">
                {col}: <span className="font-medium text-warning">{count}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
