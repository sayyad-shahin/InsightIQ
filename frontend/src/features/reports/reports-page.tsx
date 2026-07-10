import { formatDistanceToNow } from "date-fns";
import { motion } from "framer-motion";
import {
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Download,
  FileDown,
  FileText,
  Plus,
  Printer,
  Search,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { CreateReportDialog } from "@/features/reports/components/create-report-dialog";
import { ReportPreviewDialog } from "@/features/reports/components/report-preview-dialog";
import { downloadReportMarkdown, printReport } from "@/features/reports/export";
import { useDeleteReport, useReports } from "@/features/reports/hooks";
import { api } from "@/lib/api";
import { toast } from "sonner";
import type { Report } from "@/types/api";

const PAGE_SIZE = 9;

export default function ReportsPage() {
  const { data: reports = [], isLoading } = useReports();
  const del = useDeleteReport();
  const [search, setSearch] = useState("");
  const [newest, setNewest] = useState(true);
  const [page, setPage] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [preview, setPreview] = useState<Report | null>(null);
  const [toDelete, setToDelete] = useState<Report | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q ? reports.filter((r) => r.title.toLowerCase().includes(q)) : reports;
    return [...list].sort((a, b) => (newest ? 1 : -1) * (+new Date(b.created_at) - +new Date(a.created_at)));
  }, [reports, search, newest]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pageCount - 1);
  const visible = filtered.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="AI-generated executive summaries you can export and share."
        actions={
          <Button variant="gradient" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" /> New report
          </Button>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search reports…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            className="pl-9"
          />
        </div>
        <Button variant="outline" size="sm" onClick={() => setNewest((n) => !n)}>
          <ArrowUpDown className="size-4" /> {newest ? "Newest first" : "Oldest first"}
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-2xl" />
          ))}
        </div>
      ) : reports.length === 0 ? (
        <div className="card-surface">
          <EmptyState
            icon={FileText}
            title="No reports yet"
            description="Generate an executive report from any processed dataset."
            action={
              <Button variant="gradient" onClick={() => setCreateOpen(true)}>
                <Plus className="size-4" /> New report
              </Button>
            }
          />
        </div>
      ) : visible.length === 0 ? (
        <div className="card-surface">
          <EmptyState icon={Search} title="No matches" description={`No reports match "${search}".`} />
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((r, i) => (
              <ReportCard key={r.id} report={r} index={i} onPreview={setPreview} onDelete={setToDelete} />
            ))}
          </div>

          {pageCount > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={current === 0}
                aria-label="Previous page"
              >
                <ChevronLeft className="size-4" />
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {current + 1} of {pageCount}
              </span>
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                disabled={current >= pageCount - 1}
                aria-label="Next page"
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          )}
        </>
      )}

      <CreateReportDialog open={createOpen} onOpenChange={setCreateOpen} />
      <ReportPreviewDialog report={preview} onOpenChange={(o) => !o && setPreview(null)} />
      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Delete report?"
        description={`"${toDelete?.title}" will be permanently removed.`}
        confirmLabel="Delete"
        destructive
        loading={del.isPending}
        onConfirm={() => toDelete && del.mutate(toDelete.id, { onSuccess: () => setToDelete(null) })}
      />
    </div>
  );
}

function ReportCard({
  report,
  index,
  onPreview,
  onDelete,
}: {
  report: Report;
  index: number;
  onPreview: (r: Report) => void;
  onDelete: (r: Report) => void;
}) {
  async function downloadPdf() {
    try {
      await api.reports.downloadPdf(report.id, report.title);
    } catch {
      toast.error("PDF download failed");
    }
  }
  async function markdown() {
    downloadReportMarkdown(await api.reports.get(report.id));
  }
  async function print() {
    printReport(await api.reports.get(report.id));
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.3) }}
      className="group flex flex-col rounded-2xl border border-border bg-card p-4 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-soft-lg"
    >
      <div className="flex items-start gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-warning/12 text-warning">
          <FileText className="size-5" />
        </div>
        <button onClick={() => onPreview(report)} className="min-w-0 flex-1 text-left">
          <p className="line-clamp-2 font-semibold group-hover:text-primary">{report.title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(report.created_at), { addSuffix: true })}
          </p>
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Report actions">
              <Download className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={downloadPdf}>
              <Download /> Download PDF
            </DropdownMenuItem>
            <DropdownMenuItem onClick={markdown}>
              <FileDown /> Download Markdown
            </DropdownMenuItem>
            <DropdownMenuItem onClick={print}>
              <Printer /> Print
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onDelete(report)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="mt-4 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Executive summary</span>
        <Button variant="ghost" size="sm" onClick={() => onPreview(report)}>
          Preview
        </Button>
      </div>
    </motion.div>
  );
}
