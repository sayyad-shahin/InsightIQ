import { useEffect, useRef } from "react";
import Plotly from "plotly.js-dist-min";
import { useTheme } from "@/providers/theme-provider";
import { cn } from "@/lib/utils";

export interface PlotlyChartProps {
  data: Record<string, unknown>[];
  layout?: Record<string, unknown>;
  className?: string;
  height?: number;
}

const FONT = "Inter, ui-sans-serif, system-ui, sans-serif";

/**
 * Theme-aware Plotly wrapper. Uses Plotly.react for efficient updates and
 * injects a transparent background + our color tokens so charts match the UI
 * in both light and dark mode. Interactive: zoom, pan, hover, download, reset.
 */
export function PlotlyChart({ data, layout, className, height = 320 }: PlotlyChartProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const dark = resolvedTheme === "dark";
    const grid = dark ? "rgba(148,163,184,0.14)" : "rgba(100,116,139,0.16)";
    const text = dark ? "#cbd5e1" : "#475569";

    const mergedLayout: Record<string, unknown> = {
      autosize: true,
      height,
      margin: { l: 48, r: 20, t: 20, b: 40 },
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)",
      font: { family: FONT, color: text, size: 12 },
      colorway: ["#4f6ef7", "#a855f7", "#06b6d4", "#22c55e", "#f59e0b", "#ef4444"],
      xaxis: { gridcolor: grid, zeroline: false, automargin: true, ...(layout?.xaxis as object) },
      yaxis: { gridcolor: grid, zeroline: false, automargin: true, ...(layout?.yaxis as object) },
      legend: { orientation: "h", y: -0.2, font: { size: 11 } },
      hoverlabel: { bgcolor: dark ? "#0f1729" : "#ffffff", bordercolor: grid, font: { family: FONT } },
      ...layout,
    };

    const config = {
      displaylogo: false,
      responsive: true,
      modeBarButtonsToRemove: ["lasso2d", "select2d"],
      toImageButtonOptions: { format: "png", filename: "insightiq-chart", scale: 2 },
    };

    Plotly.react(el, data, mergedLayout, config);
    return () => {
      if (el) Plotly.purge(el);
    };
  }, [data, layout, height, resolvedTheme]);

  return <div ref={ref} className={cn("w-full", className)} style={{ height }} />;
}
