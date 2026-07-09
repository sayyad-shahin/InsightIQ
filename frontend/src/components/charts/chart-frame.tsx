import { Download, FileImage, FileType, Printer } from "lucide-react";
import { lazy, Suspense, useRef, useState } from "react";
import { specToLayout, specToTraces } from "@/components/charts/chart-spec";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { ChartSpec } from "@/types/api";

const PlotlyChart = lazy(() =>
  import("@/components/charts/plotly-chart").then((m) => ({ default: m.PlotlyChart })),
);

interface ChartFrameProps {
  spec?: ChartSpec;
  data?: Record<string, unknown>[];
  layout?: Record<string, unknown>;
  title?: string;
  subtitle?: string;
  height?: number;
  className?: string;
  actions?: React.ReactNode;
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "chart";

export function ChartFrame({ spec, data, layout, title, subtitle, height = 320, className, actions }: ChartFrameProps) {
  const elRef = useRef<HTMLDivElement | null>(null);
  const [ready, setReady] = useState(false);
  const heading = title ?? spec?.title;

  const traces = spec ? specToTraces(spec) : (data ?? []);
  const plotLayout = spec ? specToLayout(spec) : (layout ?? {});

  async function exportImage(format: "png" | "svg") {
    if (!elRef.current) return;
    const { downloadPlot } = await import("@/components/charts/plotly-chart");
    await downloadPlot(elRef.current, format, slug(heading ?? "chart"));
  }

  async function exportPdf() {
    if (!elRef.current) return;
    const { printPlot } = await import("@/components/charts/plotly-chart");
    await printPlot(elRef.current, heading ?? "Chart");
  }

  return (
    <div className={cn("rounded-2xl border border-border bg-card p-4 shadow-soft", className)}>
      {(heading || actions) && (
        <div className="mb-2 flex items-start justify-between gap-2">
          <div className="min-w-0">
            {heading && <p className="truncate text-sm font-semibold">{heading}</p>}
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {actions}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="Export chart" disabled={!ready}>
                  <Download className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => exportImage("png")}>
                  <FileImage /> PNG image
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportImage("svg")}>
                  <FileType /> SVG vector
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportPdf}>
                  <Printer /> Print / PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      )}
      <Suspense fallback={<Skeleton className="w-full rounded-lg" style={{ height }} />}>
        <PlotlyChart
          data={traces}
          layout={plotLayout}
          height={height}
          onReady={(el) => {
            elRef.current = el;
            setReady(true);
          }}
        />
      </Suspense>
    </div>
  );
}
