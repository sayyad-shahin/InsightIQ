import type { ReportDetail } from "@/types/api";

function stripMd(s: string) {
  return s.replace(/\*\*(.*?)\*\*/g, "$1");
}

export function reportToMarkdown(report: ReportDetail): string {
  const s = report.sections;
  const lines = [`# ${report.title}`, "", "_InsightIQ executive report_", ""];
  if (!s) return lines.join("\n");

  const o = s.overview as Record<string, unknown>;
  if (o) {
    lines.push("## Overview", "");
    lines.push(`- Dataset: ${o.dataset_name}`);
    lines.push(`- Rows: ${o.row_count} · Columns: ${o.column_count}`);
    lines.push("");
  }

  const insights = (s as unknown as Record<string, unknown>).insights as Record<string, string[]> | undefined;
  if (insights) {
    for (const [key, label] of [
      ["key_insights", "Key insights"],
      ["revenue_drivers", "Revenue drivers"],
      ["growth_trends", "Growth trends"],
      ["opportunities", "Opportunities"],
      ["risks", "Risks"],
      ["recommendations", "Executive recommendations"],
    ] as const) {
      const items = insights[key];
      if (items?.length) {
        lines.push(`## ${label}`, "");
        items.forEach((i) => lines.push(`- ${stripMd(i)}`));
        lines.push("");
      }
    }
  }
  return lines.join("\n");
}

export function downloadReportMarkdown(report: ReportDetail): void {
  const blob = new Blob([reportToMarkdown(report)], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${report.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "report"}.md`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

export function printReport(report: ReportDetail): void {
  const win = window.open("", "_blank", "width=800,height=1000");
  if (!win) return;
  // Escape content first (escapeHtml leaves markdown structural chars like # and -),
  // then promote headings/list items so injected markup can't execute.
  const html = escapeHtml(reportToMarkdown(report))
    .replace(/^# (.*)$/gm, "<h1>$1</h1>")
    .replace(/^## (.*)$/gm, "<h2>$1</h2>")
    .replace(/^- (.*)$/gm, "<li>$1</li>")
    .replace(/\n\n/g, "<br/>");
  win.document.write(
    `<!doctype html><html><head><title>${escapeHtml(report.title)}</title><style>body{font-family:sans-serif;max-width:720px;margin:40px auto;padding:0 20px;color:#111}h1{font-size:24px}h2{font-size:16px;margin-top:20px}li{margin:4px 0}</style></head><body>${html}</body></html>`,
  );
  win.document.close();
  win.focus();
  win.print();
}
