import { ChartFrame } from "@/components/charts/chart-frame";
import type { ForecastResult } from "@/types/api";

/** Build history vs forecast traces with a shaded confidence band. */
export function ForecastChart({ result, target }: { result: ForecastResult; target: string }) {
  const n = result.history.length;
  const h = result.forecast.length;
  const labels =
    result.forecast_dates && result.forecast_dates.length === h
      ? [...Array.from({ length: n }, (_, i) => `-${n - i}`), ...result.forecast_dates]
      : Array.from({ length: n + h }, (_, i) => (i < n ? `T-${n - i}` : `T+${i - n + 1}`));

  const pad = (arr: number[]) => [...Array(n).fill(null), ...arr];
  const data: Record<string, unknown>[] = [];

  if (result.upper && result.lower) {
    data.push(
      { x: labels, y: pad(result.upper), type: "scatter", mode: "lines", line: { width: 0 }, showlegend: false, hoverinfo: "skip" },
      {
        x: labels,
        y: pad(result.lower),
        type: "scatter",
        mode: "lines",
        line: { width: 0 },
        fill: "tonexty",
        fillcolor: "rgba(168,85,247,0.15)",
        name: `${Math.round((result.confidence ?? 0.95) * 100)}% interval`,
        hoverinfo: "skip",
      },
    );
  }

  data.push(
    {
      x: labels,
      y: [...result.history, ...Array(h).fill(null)],
      type: "scatter",
      mode: "lines",
      name: "History",
      line: { color: "#4f6ef7", width: 3 },
    },
    {
      x: labels,
      y: pad(result.forecast),
      type: "scatter",
      mode: "lines+markers",
      name: "Forecast",
      line: { color: "#a855f7", width: 3, dash: "dot" },
      marker: { size: 5 },
    },
  );

  return (
    <ChartFrame
      title={`${target} forecast`}
      subtitle={`${result.model_used.replace("_", " ")} · ${h} periods ahead`}
      data={data}
      layout={{ margin: { l: 52, r: 20, t: 10, b: 40 }, showlegend: true }}
      height={360}
    />
  );
}
