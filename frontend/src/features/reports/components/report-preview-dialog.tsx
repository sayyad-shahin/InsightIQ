import { Download, FileDown, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useReport } from "@/features/reports/hooks";
import { downloadReportMarkdown, printReport } from "@/features/reports/export";
import { api } from "@/lib/api";
import type { Report } from "@/types/api";

const INSIGHT_GROUPS: [string, string][] = [
  ["key_insights", "Key insights"],
  ["revenue_drivers", "Revenue drivers"],
  ["growth_trends", "Growth trends"],
  ["opportunities", "Opportunities"],
  ["risks", "Risks"],
  ["recommendations", "Executive recommendations"],
];

export function ReportPreviewDialog({ report, onOpenChange }: { report: Report | null; onOpenChange: (o: boolean) => void }) {
  const { data, isLoading } = useReport(report?.id);
  const sections = (data?.sections ?? {}) as Record<string, any>;
  const insights = sections.insights as Record<string, string[]> | undefined;

  async function downloadPdf() {
    if (!report) return;
    try {
      await api.reports.downloadPdf(report.id, report.title);
    } catch {
      toast.error("PDF download failed");
    }
  }

  return (
    <Dialog open={!!report} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl gap-0 p-0">
        <DialogHeader className="flex-row items-center justify-between border-b border-border p-5">
          <DialogTitle className="truncate">{report?.title}</DialogTitle>
          {data && (
            <div className="flex shrink-0 gap-1.5">
              <Button variant="outline" size="sm" onClick={downloadPdf}>
                <Download className="size-4" /> PDF
              </Button>
              <Button variant="ghost" size="icon-sm" onClick={() => downloadReportMarkdown(data)} aria-label="Download Markdown">
                <FileDown className="size-4" />
              </Button>
              <Button variant="ghost" size="icon-sm" onClick={() => printReport(data)} aria-label="Print">
                <Printer className="size-4" />
              </Button>
            </div>
          )}
        </DialogHeader>

        <ScrollArea className="max-h-[65vh] p-5">
          {isLoading || !data ? (
            <div className="space-y-3">
              <Skeleton className="h-20 rounded-xl" />
              <Skeleton className="h-32 rounded-xl" />
            </div>
          ) : (
            <div className="space-y-5">
              {sections.overview && (
                <Section title="Overview">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <Stat label="Rows" value={String(sections.overview.row_count ?? "—")} />
                    <Stat label="Columns" value={String(sections.overview.column_count ?? "—")} />
                    <Stat label="Type" value={String(sections.overview.source_type ?? "").toUpperCase()} />
                    {sections.highlights?.quality_score != null && <Stat label="Quality" value={`${sections.highlights.quality_score}/100`} />}
                  </div>
                </Section>
              )}

              {insights &&
                INSIGHT_GROUPS.map(([key, label]) =>
                  insights[key]?.length ? (
                    <Section key={key} title={label}>
                      <ul className="space-y-1.5">
                        {insights[key].map((item, i) => (
                          <li key={i} className="flex gap-2 text-sm text-foreground/85">
                            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                            <span>{item.replace(/\*\*(.*?)\*\*/g, "$1")}</span>
                          </li>
                        ))}
                      </ul>
                    </Section>
                  ) : null,
                )}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      {children}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/40 p-2.5">
      <p className="text-base font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
