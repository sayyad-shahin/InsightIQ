import type { ForecastDetail } from "@/types/api";

export function forecastToCsv(forecast: ForecastDetail): string {
  const r = forecast.result;
  if (!r) return "";
  const rows: string[] = ["period,type,value,lower,upper"];
  r.history.forEach((v, i) => rows.push(`T-${r.history.length - i},history,${v},,`));
  r.forecast.forEach((v, i) => {
    const label = r.forecast_dates?.[i] ?? `T+${i + 1}`;
    rows.push(`${label},forecast,${v},${r.lower?.[i] ?? ""},${r.upper?.[i] ?? ""}`);
  });
  return rows.join("\n");
}

export function downloadForecastCsv(forecast: ForecastDetail): void {
  const blob = new Blob([forecastToCsv(forecast)], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `forecast-${forecast.target_column}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
