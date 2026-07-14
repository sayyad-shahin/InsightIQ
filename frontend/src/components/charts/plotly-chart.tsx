import { useEffect, useRef } from "react";
import Plotly from "@/lib/plotly";
import { useTheme } from "@/providers/theme-provider";
import { cn } from "@/lib/utils";

export interface PlotlyChartProps {
  data: Record<string, unknown>[];
  layout?: Record<string, unknown>;
  className?: string;
  height?: number;
  onReady?: (el: HTMLDivElement) => void;
}

const FONT = "Inter, ui-sans-serif, system-ui, sans-serif";

/** Download the rendered chart as PNG or SVG. */
export async function downloadPlot(el: HTMLDivElement, format: "png" | "svg", filename: string) {
  const dataUrl = await Plotly.downloadImage(el, { format, filename, width: 1200, height: 700, scale: 2 });
  return dataUrl;
}

/** Open a print-ready window with the chart image (users can Save as PDF). */
export async function printPlot(el: HTMLDivElement, title: string) {
  const dataUrl = (await Plotly.downloadImage(el, {
    format: "png",
    filename: "chart",
    width: 1200,
    height: 700,
    scale: 2,
  })) as unknown as string;
  const win = window.open("", "_blank", "width=900,height=700");
  if (!win) return;
  win.document.write(
    `<!doctype html><html><head><title>${title}</title></head>` +
      `<body style="margin:24px;font-family:sans-serif"><h3>${title}</h3>` +
      `<img src="${dataUrl}" style="max-width:100%"/></body></html>`,
  );
  win.document.close();
  win.focus();
  win.print();
}

/**
 * Theme-aware Plotly wrapper. Uses Plotly.react for efficient updates and
 * injects a transparent background + our color tokens so charts match the UI
 * in both light and dark mode. Interactive: zoom, pan, hover, download, reset.
 */
export function PlotlyChart({ data, layout, className, height = 320, onReady }: PlotlyChartProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const dark = resolvedTheme === "dark";
    const grid = dark ? "rgba(148,163,184,0.14)" : "rgba(100,116,139,0.16)";
    const text = dark ? "#cbd5e1" : "#475569";

    // The caller's `layout` is spread FIRST, then the axis defaults are applied
    // LAST. This guarantees `xaxis`/`yaxis` are always valid objects: a caller
    // layout that omits or nulls an axis (e.g. specToLayout emits `xaxis:
    // undefined` when there is no title) can never leave an undefined axis in
    // the merged layout — Plotly's cleanLayout crashes on `undefined.anchor`.
    // Any axis object the caller *does* provide is merged onto the defaults.
    const mergedLayout: Record<string, unknown> = {
      autosize: true,
      height,
      margin: { l: 48, r: 20, t: 20, b: 40 },
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)",
      font: { family: FONT, color: text, size: 12 },
      colorway: ["#4f6ef7", "#a855f7", "#06b6d4", "#22c55e", "#f59e0b", "#ef4444"],
      legend: { orientation: "h", y: -0.2, font: { size: 11 } },
      hoverlabel: { bgcolor: dark ? "#0f1729" : "#ffffff", bordercolor: grid, font: { family: FONT } },
      ...layout,
      xaxis: { gridcolor: grid, zeroline: false, automargin: true, ...(layout?.xaxis as object) },
      yaxis: { gridcolor: grid, zeroline: false, automargin: true, ...(layout?.yaxis as object) },
    };

    const config = {
      displaylogo: false,
      responsive: true,
      modeBarButtonsToRemove: ["lasso2d", "select2d"],
      toImageButtonOptions: { format: "png", filename: "insightiq-chart", scale: 2 },
    };

    // Defer the draw to the next frame. Under React StrictMode (dev) the effect
    // mounts -> unmounts -> remounts; without this deferral the throwaway first
    // mount kicks off Plotly's async auto-margin redraw and the cleanup purge
    // runs before it fires, crashing on the purged graph div
    // (_redrawFromAutoMarginCount of undefined). The rAF is cancelled on the
    // throwaway unmount, so only the surviving mount ever draws.
    let disposed = false;
    const raf = requestAnimationFrame(() => {
      if (disposed || !el.isConnected) return;
      Plotly.react(el, data, mergedLayout, config).then(() => {
        if (!disposed) onReady?.(el);
      });
    });
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
    };
  }, [data, layout, height, resolvedTheme, onReady]);

  // Purge only on true unmount (Plotly.react handles in-place updates above).
  useEffect(() => {
    const el = ref.current;
    return () => {
      try {
        if (el) Plotly.purge(el);
      } catch {
        /* node already torn down */
      }
    };
  }, []);

  return <div ref={ref} className={cn("w-full", className)} style={{ height }} />;
}
