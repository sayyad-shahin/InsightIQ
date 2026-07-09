import { formatDistanceToNow } from "date-fns";
import { motion } from "framer-motion";
import { Download, Loader2, Play, Trash2, TrendingUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { DatasetSelect } from "@/components/shared/dataset-select";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { ForecastStatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ForecastChart } from "@/features/forecasts/components/forecast-chart";
import { downloadForecastCsv } from "@/features/forecasts/export";
import { useCreateForecast, useDeleteForecast, useForecast, useForecasts } from "@/features/forecasts/hooks";
import { useDataset, useDatasets } from "@/features/datasets/hooks";
import { cn } from "@/lib/utils";
import type { ForecastModelType } from "@/types/api";

const HORIZONS = [30, 90, 180, 365];

export default function ForecastsPage() {
  const datasets = useDatasets().data ?? [];
  const ready = useMemo(() => datasets.filter((d) => d.status === "cleaned"), [datasets]);

  const [datasetId, setDatasetId] = useState("");
  const [target, setTarget] = useState("");
  const [model, setModel] = useState<ForecastModelType>("sklearn_regression");
  const [horizon, setHorizon] = useState(90);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!datasetId && ready.length) setDatasetId(ready[0].id);
  }, [ready, datasetId]);

  const detailQ = useDataset(datasetId || undefined);
  const numericColumns = useMemo(
    () =>
      (detailQ.data?.schema_snapshot?.columns ?? [])
        .filter((c) => /int|float|number|decimal/i.test(c.dtype))
        .map((c) => c.name),
    [detailQ.data],
  );

  useEffect(() => {
    if (numericColumns.length && !numericColumns.includes(target)) setTarget(numericColumns[0]);
  }, [numericColumns, target]);

  const forecastsQ = useForecasts(datasetId || undefined);
  const forecasts = forecastsQ.data ?? [];
  const create = useCreateForecast();
  const del = useDeleteForecast();
  const selected = useForecast(selectedId ?? undefined);

  function runForecast() {
    if (!datasetId || !target) return;
    create.mutate(
      { dataset_id: datasetId, target_column: target, model_type: model, horizon_periods: horizon },
      { onSuccess: (f) => setSelectedId(f.id) },
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Forecasting"
        description="Project future trends with confidence intervals and accuracy metrics."
        actions={<DatasetSelect datasets={datasets} value={datasetId} onChange={(id) => { setDatasetId(id); setSelectedId(null); }} className="w-64" />}
      />

      {ready.length === 0 ? (
        <div className="card-surface">
          <EmptyState icon={TrendingUp} title="No processed datasets" description="Upload and process a dataset to run forecasts." />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[20rem_1fr]">
          {/* Left rail: create + history */}
          <div className="space-y-4">
            <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
              <p className="mb-3 text-sm font-semibold">New forecast</p>
              <div className="space-y-3">
                <Field label="Target column">
                  <select value={target} onChange={(e) => setTarget(e.target.value)} disabled={!numericColumns.length} className={selectClass}>
                    {numericColumns.length === 0 && <option value="">No numeric columns</option>}
                    {numericColumns.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Model">
                  <select value={model} onChange={(e) => setModel(e.target.value as ForecastModelType)} className={selectClass}>
                    <option value="sklearn_regression">Linear regression</option>
                    <option value="prophet">Prophet (seasonal)</option>
                  </select>
                </Field>
                <Field label="Horizon (periods)">
                  <div className="grid grid-cols-4 gap-1.5">
                    {HORIZONS.map((h) => (
                      <button
                        key={h}
                        onClick={() => setHorizon(h)}
                        className={cn(
                          "rounded-lg border py-1.5 text-xs font-medium transition",
                          horizon === h ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-accent",
                        )}
                      >
                        {h}
                      </button>
                    ))}
                  </div>
                </Field>
                <Button variant="gradient" className="w-full" onClick={runForecast} loading={create.isPending} disabled={!target}>
                  <Play className="size-4" /> Run forecast
                </Button>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
              <p className="mb-3 text-sm font-semibold">History</p>
              {forecastsQ.isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 rounded-lg" />
                  ))}
                </div>
              ) : forecasts.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">No forecasts yet.</p>
              ) : (
                <div className="space-y-1.5">
                  {forecasts.map((f) => (
                    <div
                      key={f.id}
                      className={cn(
                        "group flex items-center gap-2 rounded-xl border px-2.5 py-2 transition",
                        selectedId === f.id ? "border-primary bg-accent" : "border-transparent hover:bg-accent/60",
                      )}
                    >
                      <button onClick={() => setSelectedId(f.id)} className="min-w-0 flex-1 text-left">
                        <p className="truncate text-sm font-medium">{f.target_column}</p>
                        <p className="text-xs text-muted-foreground">
                          {f.horizon_periods}p · {formatDistanceToNow(new Date(f.created_at), { addSuffix: true })}
                        </p>
                      </button>
                      <ForecastStatusBadge status={f.status} />
                      <button
                        onClick={() => { del.mutate(f.id); if (selectedId === f.id) setSelectedId(null); }}
                        className="text-muted-foreground opacity-0 transition hover:text-destructive group-hover:opacity-100"
                        aria-label="Delete forecast"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Detail */}
          <div>
            {!selectedId ? (
              <div className="card-surface h-full">
                <EmptyState icon={TrendingUp} title="Select or run a forecast" description="Configure a target and horizon, then run a forecast to see projections here." />
              </div>
            ) : (
              <ForecastDetailView key={selectedId} forecastQuery={selected} onDownload={() => selected.data && downloadForecastCsv(selected.data)} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ForecastDetailView({ forecastQuery, onDownload }: { forecastQuery: ReturnType<typeof useForecast>; onDownload: () => void }) {
  const f = forecastQuery.data;
  if (forecastQuery.isLoading || !f) return <Skeleton className="h-96 rounded-2xl" />;

  if (f.status === "queued" || f.status === "running") {
    return (
      <div className="card-surface flex h-full flex-col items-center justify-center gap-3 py-20">
        <Loader2 className="size-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Running {f.model_type.replace("_", " ")} forecast…</p>
      </div>
    );
  }
  if (f.status === "failed") {
    return (
      <div className="card-surface">
        <EmptyState icon={TrendingUp} title="Forecast failed" description={f.error_message ?? "The model could not be fit."} />
      </div>
    );
  }
  if (!f.result) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">{f.target_column}</h2>
          <p className="text-sm text-muted-foreground">
            {f.result.model_used.replace("_", " ")} · {f.horizon_periods} periods
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onDownload}>
          <Download className="size-4" /> Download CSV
        </Button>
      </div>

      <ForecastChart result={f.result} target={f.target_column} />

      {f.result.metrics && (
        <div className="grid grid-cols-3 gap-3">
          <Metric label="R² (fit)" value={f.result.metrics.r2.toFixed(3)} hint="Higher is better" />
          <Metric label="MAE" value={f.result.metrics.mae.toFixed(2)} hint="Mean abs. error" />
          <Metric label="RMSE" value={f.result.metrics.rmse.toFixed(2)} hint="Root mean sq. error" />
        </div>
      )}

      {f.result.note && <p className="rounded-xl border border-warning/30 bg-warning/10 p-3 text-sm text-warning">{f.result.note}</p>}
    </motion.div>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
      <p className="text-2xl font-bold tabular-nums">{value}</p>
      <p className="text-sm font-medium">{label}</p>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

const selectClass = "h-9 w-full rounded-lg border border-input bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";
