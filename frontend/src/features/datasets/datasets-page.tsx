import { AnimatePresence, motion } from "framer-motion";
import { Database, LayoutGrid, List, Search, Upload } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { DataCleaningDialog } from "@/features/datasets/components/data-cleaning-dialog";
import { DatasetCard } from "@/features/datasets/components/dataset-card";
import { DatasetPreviewDialog } from "@/features/datasets/components/dataset-preview-dialog";
import { DatasetTable, type SortDir, type SortKey } from "@/features/datasets/components/dataset-table";
import { RenameDialog } from "@/features/datasets/components/rename-dialog";
import { UploadDialog } from "@/features/datasets/components/upload-dialog";
import { useDatasets } from "@/features/datasets/hooks";
import { cn } from "@/lib/utils";
import type { Dataset } from "@/types/api";

type ViewMode = "grid" | "list";

export default function DatasetsPage() {
  const { data: datasets = [], isLoading, isError, refetch } = useDatasets();
  const [params, setParams] = useSearchParams();

  const [view, setView] = useState<ViewMode>("grid");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const [uploadOpen, setUploadOpen] = useState(params.get("upload") === "1");
  const [previewTarget, setPreviewTarget] = useState<Dataset | null>(null);
  const [cleanTarget, setCleanTarget] = useState<Dataset | null>(null);
  const [renameTarget, setRenameTarget] = useState<Dataset | null>(null);

  // Consume the ?upload=1 deep-link (from dashboard / command palette) once.
  useEffect(() => {
    if (params.get("upload") === "1") {
      setUploadOpen(true);
      params.delete("upload");
      setParams(params, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keyboard shortcut: "u" opens the uploader.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (e.key === "u" && !e.metaKey && !e.ctrlKey && tag !== "INPUT" && tag !== "TEXTAREA") {
        setUploadOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  function handleSort(key: SortKey) {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(key === "name" ? "asc" : "desc");
    }
  }

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q ? datasets.filter((d) => d.name.toLowerCase().includes(q)) : datasets;
    const sorted = [...filtered].sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      switch (sortKey) {
        case "name":
          return a.name.localeCompare(b.name) * dir;
        case "row_count":
          return ((a.row_count ?? 0) - (b.row_count ?? 0)) * dir;
        case "column_count":
          return ((a.column_count ?? 0) - (b.column_count ?? 0)) * dir;
        case "status":
          return a.status.localeCompare(b.status) * dir;
        default:
          return (+new Date(a.created_at) - +new Date(b.created_at)) * dir;
      }
    });
    return sorted;
  }, [datasets, search, sortKey, sortDir]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Datasets"
        description="Upload, explore, and clean your data sources."
        actions={
          <Button variant="gradient" onClick={() => setUploadOpen(true)}>
            <Upload className="size-4" /> Upload
          </Button>
        }
      />

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search datasets…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-1 rounded-xl border border-border bg-card p-1">
          <ViewButton active={view === "grid"} onClick={() => setView("grid")} icon={LayoutGrid} label="Grid" />
          <ViewButton active={view === "list"} onClick={() => setView("list")} icon={List} label="List" />
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <DatasetsSkeleton view={view} />
      ) : isError ? (
        <div className="card-surface">
          <EmptyState
            icon={Database}
            title="Couldn't load datasets"
            description="Something went wrong reaching the server."
            action={<Button onClick={() => refetch()}>Retry</Button>}
          />
        </div>
      ) : datasets.length === 0 ? (
        <div className="card-surface">
          <EmptyState
            icon={Database}
            title="No datasets yet"
            description="Upload a CSV, Excel, PDF, or SQL file to get started."
            action={
              <Button variant="gradient" onClick={() => setUploadOpen(true)}>
                <Upload className="size-4" /> Upload your first dataset
              </Button>
            }
          />
        </div>
      ) : visible.length === 0 ? (
        <div className="card-surface">
          <EmptyState icon={Search} title="No matches" description={`No datasets match "${search}".`} />
        </div>
      ) : view === "grid" ? (
        <motion.div layout className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {visible.map((d, i) => (
              <DatasetCard
                key={d.id}
                dataset={d}
                index={i}
                onPreview={setPreviewTarget}
                onClean={setCleanTarget}
                onRename={setRenameTarget}
              />
            ))}
          </AnimatePresence>
        </motion.div>
      ) : (
        <DatasetTable
          datasets={visible}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={handleSort}
          onPreview={setPreviewTarget}
          onClean={setCleanTarget}
          onRename={setRenameTarget}
        />
      )}

      {/* Dialogs */}
      <UploadDialog open={uploadOpen} onOpenChange={setUploadOpen} datasets={datasets} />
      <DatasetPreviewDialog dataset={previewTarget} onOpenChange={(o) => !o && setPreviewTarget(null)} />
      <DataCleaningDialog dataset={cleanTarget} onOpenChange={(o) => !o && setCleanTarget(null)} />
      <RenameDialog dataset={renameTarget} onOpenChange={(o) => !o && setRenameTarget(null)} />
    </div>
  );
}

function ViewButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof LayoutGrid;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={cn(
        "grid size-8 place-items-center rounded-lg transition-colors",
        active ? "bg-brand-gradient text-white shadow-soft" : "text-muted-foreground hover:bg-accent",
      )}
    >
      <Icon className="size-4" />
    </button>
  );
}

function DatasetsSkeleton({ view }: { view: ViewMode }) {
  if (view === "list") return <Skeleton className="h-80 w-full rounded-2xl" />;
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-36 rounded-2xl" />
      ))}
    </div>
  );
}
