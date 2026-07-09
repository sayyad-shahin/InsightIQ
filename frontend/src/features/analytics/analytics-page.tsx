import { useEffect, useMemo, useState } from "react";
import { BarChart3, Database, Gauge, Percent, Rows3, Sigma } from "lucide-react";
import { ChartFrame } from "@/components/charts/chart-frame";
import { DatasetSelect } from "@/components/shared/dataset-select";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { KpiCard } from "@/features/dashboard/components/kpi-card";
import { AnomalyPanel } from "@/features/analytics/components/anomaly-panel";
import { InsightCards } from "@/features/analytics/components/insight-cards";
import { useAnalytics } from "@/features/analytics/hooks";
import { useDatasets } from "@/features/datasets/hooks";
import { formatCompact, formatNumber } from "@/lib/utils";
import type { ChartSpec, DatasetAnalytics } from "@/types/api";

export default function AnalyticsPage() {
  const datasets = useDatasets().data ?? [];
  const ready = useMemo(() => datasets.filter((d) => d.status === "cleaned"), [datasets]);

  const [datasetId, setDatasetId] = useState("");
  const [measure, setMeasure] = useState("");
  const [dimension, setDimension] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => {
    if (!datasetId && ready.length) setDatasetId(ready[0].id);
  }, [ready, datasetId]);

  const { data, isLoading, isError, refetch, isFetching } = useAnalytics(datasetId || undefined, {
    measure: measure || undefined,
    dimension: dimension || undefined,
  });

  // Reset drill selections when switching datasets.
  function selectDataset(id: string) {
    setDatasetId(id);
    setMeasure("");
    setDimension("");
    setFrom("");
    setTo("");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description="Executive analysis computed across your full dataset."
        actions={
          <DatasetSelect datasets={datasets} value={datasetId} onChange={selectDataset} className="w-64" />
        }
      />

      {ready.length === 0 ? (
        <div className="card-surface">
          <EmptyState icon={Database} title="No processed datasets" description="Upload and process a dataset to explore analytics." />
        </div>
      ) : isLoading || !data ? (
        <AnalyticsSkeleton />
      ) : isError ? (
        <div className="card-surface">
          <EmptyState icon={BarChart3} title="Couldn't load analytics" action={<Button onClick={() => refetch()}>Retry</Button>} />
        </div>
      ) : (
        <div className={isFetching ? "space-y-8 opacity-70 transition-opacity" : "space-y-8"}>
          <Kpis data={data} />

          {/* Drill-down controls */}
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-soft">
            <Selector label="Measure" value={data.primary_measure ?? ""} options={data.options.measures} onChange={setMeasure} />
            <Selector label="Breakdown by" value={data.dimension ?? ""} options={data.options.dimensions} onChange={setDimension} />
          </div>

          <Section title="Business insights">
            <InsightCards insights={data.insights} />
          </Section>

          {data.trend && (
            <Section title="Sales & revenue trend" actions={<DateRange from={from} to={to} onFrom={setFrom} onTo={setTo} />}>
              <ChartFrame spec={windowTrend(data.trend.chart, from, to)} height={340} subtitle={`Change ${data.trend.change_pct >= 0 ? "+" : ""}${data.trend.change_pct}% · peak ${data.trend.peak.date}`} />
            </Section>
          )}

          {data.category_breakdown && (
            <Section title="Category breakdown">
              <div className="grid gap-4 lg:grid-cols-2">
                <ChartFrame spec={data.category_breakdown.bar} height={320} />
                <ChartFrame spec={data.category_breakdown.pie} height={320} />
              </div>
            </Section>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            {data.segmentation && (
              <Section title="Customer segmentation">
                <ChartFrame spec={data.segmentation.chart} height={300} />
              </Section>
            )}
            {data.geographic && (
              <Section title="Geographic analysis">
                <ChartFrame spec={data.geographic.chart} height={300} />
              </Section>
            )}
          </div>

          {data.correlation && (
            <Section title="Correlation matrix">
              <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
                <ChartFrame spec={data.correlation.chart} height={360} />
                <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
                  <p className="mb-2 text-sm font-semibold">Strongest relationships</p>
                  <ul className="space-y-2">
                    {data.correlation.top_pairs.map((p, i) => (
                      <li key={i} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          {p.a} ↔ {p.b}
                        </span>
                        <span className={`font-semibold tabular-nums ${p.value >= 0 ? "text-success" : "text-destructive"}`}>
                          {p.value >= 0 ? "+" : ""}
                          {p.value}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </Section>
          )}

          <Section title="Missing value analysis">
            <MissingValues data={data} />
          </Section>

          <Section title="Anomaly detection">
            <AnomalyPanel items={data.anomalies.items} chart={data.anomalies.chart} recommendations={data.anomalies.recommendations} />
          </Section>
        </div>
      )}
    </div>
  );
}

function Kpis({ data }: { data: DatasetAnalytics }) {
  const primary = data.kpis.measures.find((m) => m.is_primary) ?? data.kpis.measures[0];
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <KpiCard index={0} label="Records" value={formatNumber(data.kpis.row_count)} icon={Rows3} />
      <KpiCard index={1} label="Data quality" value={`${data.kpis.quality_score}/100`} icon={Gauge} />
      <KpiCard index={2} label="Completeness" value={`${data.kpis.completeness}%`} icon={Percent} />
      <KpiCard
        index={3}
        label={primary ? `Total ${primary.name}` : "Columns"}
        value={primary ? formatCompact(primary.total) : String(data.kpis.column_count)}
        icon={Sigma}
      />
    </div>
  );
}

function Selector({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  if (options.length === 0) return null;
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 rounded-lg border border-input bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

function DateRange({ from, to, onFrom, onTo }: { from: string; to: string; onFrom: (v: string) => void; onTo: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <input type="date" value={from} onChange={(e) => onFrom(e.target.value)} className="h-8 rounded-lg border border-input bg-background px-2 outline-none" />
      <span>→</span>
      <input type="date" value={to} onChange={(e) => onTo(e.target.value)} className="h-8 rounded-lg border border-input bg-background px-2 outline-none" />
    </div>
  );
}

function windowTrend(spec: ChartSpec, from: string, to: string): ChartSpec {
  if (!from && !to) return spec;
  const x = (spec.x ?? []) as string[];
  const keep = x.map((d) => (!from || d >= from) && (!to || d <= to));
  return {
    ...spec,
    x: x.filter((_, i) => keep[i]),
    series: spec.series?.map((s) => ({ ...s, values: s.values.filter((_, i) => keep[i]) })),
  };
}

function MissingValues({ data }: { data: DatasetAnalytics }) {
  const cols = data.missing_values.columns;
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
      <p className="mb-3 text-sm text-muted-foreground">
        {cols.length === 0 ? "No missing values detected." : `${cols.length} column(s) with missing values`}
        {data.missing_values.duplicate_rows > 0 && ` · ${data.missing_values.duplicate_rows} duplicate row(s)`}
      </p>
      <div className="space-y-2">
        {cols.map((c) => (
          <div key={c.name} className="flex items-center gap-3 text-sm">
            <span className="w-40 shrink-0 truncate">{c.name}</span>
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-warning" style={{ width: `${Math.min(100, c.missing_pct)}%` }} />
            </div>
            <span className="w-24 shrink-0 text-right text-xs text-muted-foreground">
              {c.missing_count} ({c.missing_pct}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Section({ title, actions, children }: { title: string; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {actions}
      </div>
      {children}
    </section>
  );
}

function AnalyticsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-2xl" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-72 rounded-2xl" />
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    </div>
  );
}
