import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Bot,
  Database,
  FileText,
  Lightbulb,
  Plus,
  Rows3,
  Sparkles,
  TrendingUp,
  Upload,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { PlotlyChart } from "@/components/charts/plotly-chart";
import { EmptyState } from "@/components/shared/empty-state";
import { DatasetStatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { KpiCard } from "@/features/dashboard/components/kpi-card";
import { api } from "@/lib/api";
import { useAuth } from "@/providers/auth-provider";
import { formatCompact, formatNumber } from "@/lib/utils";
import type { Chat, Dataset, Forecast, Report } from "@/types/api";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const datasetsQ = useQuery({ queryKey: ["datasets"], queryFn: api.datasets.list });
  const forecastsQ = useQuery({ queryKey: ["forecasts"], queryFn: () => api.forecasts.list() });
  const reportsQ = useQuery({ queryKey: ["reports"], queryFn: api.reports.list });
  const chatsQ = useQuery({ queryKey: ["chats"], queryFn: api.chats.list });

  const datasets = datasetsQ.data ?? [];
  const forecasts = forecastsQ.data ?? [];
  const reports = reportsQ.data ?? [];
  const chats = chatsQ.data ?? [];
  const loading =
    datasetsQ.isLoading || forecastsQ.isLoading || reportsQ.isLoading || chatsQ.isLoading;

  const activity = buildActivity(datasets, forecasts, reports, chats);

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {greeting()}, {user?.full_name.split(" ")[0]} 👋
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Here's what's happening in your workspace.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to="/app/chat">
              <Bot className="size-4" /> Ask AI
            </Link>
          </Button>
          <Button variant="gradient" asChild>
            <Link to="/app/datasets?upload=1">
              <Upload className="size-4" /> Upload data
            </Link>
          </Button>
        </div>
      </motion.div>

      {/* KPIs */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard index={0} label="Datasets" value={formatNumber(datasets.length)} icon={Database} spark={dailySpark(datasets)} />
          <KpiCard index={1} label="Conversations" value={formatNumber(chats.length)} icon={Bot} spark={dailySpark(chats)} />
          <KpiCard index={2} label="Forecasts" value={formatNumber(forecasts.length)} icon={TrendingUp} spark={dailySpark(forecasts)} />
          <KpiCard index={3} label="Reports" value={formatNumber(reports.length)} icon={FileText} spark={dailySpark(reports)} />
        </div>
      )}

      {/* Charts + insights */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Data ingestion trend</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">Cumulative datasets over time</p>
            </div>
            <TrendingUp className="size-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-72 w-full rounded-xl" />
            ) : datasets.length === 0 ? (
              <EmptyState icon={Database} title="No data yet" description="Upload your first dataset to see trends here." action={<Button variant="gradient" size="sm" onClick={() => navigate("/app/datasets?upload=1")}><Plus className="size-4" /> Upload dataset</Button>} />
            ) : (
              <IngestionChart datasets={datasets} />
            )}
          </CardContent>
        </Card>

        <AiInsightsPanel datasets={datasets} loading={loading} />
      </div>

      {/* Rows per dataset + activity */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Rows per dataset</CardTitle>
            <Rows3 className="size-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-64 w-full rounded-xl" />
            ) : datasets.filter((d) => d.row_count).length === 0 ? (
              <EmptyState icon={Rows3} title="Nothing to chart yet" description="Processed datasets will appear here." />
            ) : (
              <RowsChart datasets={datasets} />
            )}
          </CardContent>
        </Card>

        <ActivityTimeline activity={activity} loading={loading} />
      </div>

      {/* Recent uploads + reports */}
      <div className="grid gap-4 lg:grid-cols-2">
        <RecentUploads datasets={datasets} loading={loading} />
        <RecentReports reports={reports} loading={loading} />
      </div>
    </div>
  );
}

function IngestionChart({ datasets }: { datasets: Dataset[] }) {
  const sorted = [...datasets].sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
  const x: string[] = [];
  const y: number[] = [];
  sorted.forEach((d, i) => {
    x.push(new Date(d.created_at).toLocaleDateString());
    y.push(i + 1);
  });
  return (
    <PlotlyChart
      height={288}
      data={[
        {
          x,
          y,
          type: "scatter",
          mode: "lines",
          fill: "tozeroy",
          line: { color: "#4f6ef7", width: 3, shape: "spline" },
          fillcolor: "rgba(79,110,247,0.12)",
          hovertemplate: "%{y} datasets<extra></extra>",
        },
      ]}
    />
  );
}

function RowsChart({ datasets }: { datasets: Dataset[] }) {
  const top = datasets.filter((d) => d.row_count).slice(0, 8);
  return (
    <PlotlyChart
      height={256}
      data={[
        {
          x: top.map((d) => (d.name.length > 14 ? d.name.slice(0, 12) + "…" : d.name)),
          y: top.map((d) => d.row_count),
          type: "bar",
          marker: { color: "#4f6ef7", line: { width: 0 } },
          hovertemplate: "%{y} rows<extra></extra>",
        },
      ]}
      layout={{ bargap: 0.5 }}
    />
  );
}

function AiInsightsPanel({ datasets, loading }: { datasets: Dataset[]; loading: boolean }) {
  const suggestions = datasets.length
    ? [
        `You have ${datasets.length} dataset${datasets.length > 1 ? "s" : ""} ready to analyze.`,
        "Ask the AI assistant to summarize your latest upload.",
        "Generate a forecast to predict next-period trends.",
      ]
    : ["Upload a dataset to unlock AI-powered insights.", "Chat with your data in plain English.", "Forecast trends with one click."];

  return (
    <Card className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-mesh opacity-60" />
      <CardHeader className="relative flex-row items-center gap-2">
        <div className="grid size-8 place-items-center rounded-lg bg-brand-gradient text-white">
          <Sparkles className="size-4" />
        </div>
        <CardTitle>AI insights</CardTitle>
      </CardHeader>
      <CardContent className="relative space-y-3">
        {loading ? (
          <>
            <Skeleton className="h-16 rounded-xl" />
            <Skeleton className="h-16 rounded-xl" />
          </>
        ) : (
          suggestions.map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08 }}
              className="flex gap-3 rounded-xl border border-border bg-card/70 p-3 backdrop-blur"
            >
              <Lightbulb className="mt-0.5 size-4 shrink-0 text-warning" />
              <p className="text-sm text-foreground/90">{s}</p>
            </motion.div>
          ))
        )}
        <Button asChild variant="outline" className="w-full">
          <Link to="/app/chat">
            Open AI chat <ArrowRight className="size-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

interface ActivityItem {
  id: string;
  label: string;
  time: string;
  icon: typeof Database;
  tone: string;
}

function buildActivity(datasets: Dataset[], forecasts: Forecast[], reports: Report[], chats: Chat[]): ActivityItem[] {
  const items: ActivityItem[] = [
    ...datasets.map((d) => ({ id: `d-${d.id}`, label: `Uploaded ${d.name}`, time: d.created_at, icon: Database, tone: "text-primary" })),
    ...forecasts.map((f) => ({ id: `f-${f.id}`, label: `Forecast on ${f.target_column}`, time: f.created_at, icon: TrendingUp, tone: "text-success" })),
    ...reports.map((r) => ({ id: `r-${r.id}`, label: `Report: ${r.title}`, time: r.created_at, icon: FileText, tone: "text-warning" })),
    ...chats.map((c) => ({ id: `c-${c.id}`, label: `Chat: ${c.title}`, time: c.created_at, icon: Bot, tone: "text-brand-400" })),
  ];
  return items.sort((a, b) => +new Date(b.time) - +new Date(a.time)).slice(0, 6);
}

/** Real 7-day sparkline: count of items created per day, scaled to 0–100. */
function dailySpark(items: { created_at: string }[]): number[] {
  const days = 7;
  const now = new Date();
  const buckets = Array<number>(days).fill(0);
  for (const it of items) {
    const diff = Math.floor((+now - +new Date(it.created_at)) / 86_400_000);
    if (diff >= 0 && diff < days) buckets[days - 1 - diff] += 1;
  }
  const max = Math.max(...buckets, 1);
  return buckets.map((c) => Math.round((c / max) * 100));
}

function ActivityTimeline({ activity, loading }: { activity: ActivityItem[]; loading: boolean }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent activity</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 rounded-lg" />
            ))}
          </div>
        ) : activity.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No activity yet.</p>
        ) : (
          <div className="relative space-y-1">
            {activity.map((item, i) => (
              <div key={item.id} className="relative flex gap-3 pb-4 last:pb-0">
                {i < activity.length - 1 && <div className="absolute left-[15px] top-8 h-full w-px bg-border" />}
                <div className="grid size-8 shrink-0 place-items-center rounded-full border border-border bg-card">
                  <item.icon className={`size-4 ${item.tone}`} />
                </div>
                <div className="min-w-0 flex-1 pt-1">
                  <p className="truncate text-sm">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(item.time), { addSuffix: true })}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RecentUploads({ datasets, loading }: { datasets: Dataset[]; loading: boolean }) {
  const recent = [...datasets].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)).slice(0, 5);
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Recent uploads</CardTitle>
        <Button asChild variant="ghost" size="sm">
          <Link to="/app/datasets">View all</Link>
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12 rounded-lg" />
            ))}
          </div>
        ) : recent.length === 0 ? (
          <EmptyState icon={Upload} title="No uploads yet" />
        ) : (
          <div className="space-y-1">
            {recent.map((d) => (
              <Link
                key={d.id}
                to="/app/datasets"
                className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition hover:bg-accent"
              >
                <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted">
                  <Database className="size-4 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{d.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {d.row_count ? `${formatCompact(d.row_count)} rows` : "Processing…"}
                  </p>
                </div>
                <DatasetStatusBadge status={d.status} />
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RecentReports({ reports, loading }: { reports: Report[]; loading: boolean }) {
  const recent = [...reports].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)).slice(0, 5);
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Recent reports</CardTitle>
        <Button asChild variant="ghost" size="sm">
          <Link to="/app/reports">View all</Link>
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12 rounded-lg" />
            ))}
          </div>
        ) : recent.length === 0 ? (
          <EmptyState icon={FileText} title="No reports yet" description="Generate a report from any dataset." />
        ) : (
          <div className="space-y-1">
            {recent.map((r) => (
              <Link
                key={r.id}
                to="/app/reports"
                className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition hover:bg-accent"
              >
                <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-warning/12">
                  <FileText className="size-4 text-warning" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{r.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                  </p>
                </div>
                <ArrowRight className="size-4 text-muted-foreground" />
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
