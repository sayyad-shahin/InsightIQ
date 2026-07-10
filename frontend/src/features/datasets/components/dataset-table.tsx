import { formatDistanceToNow } from "date-fns";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { DatasetStatusBadge } from "@/components/shared/status-badge";
import { DatasetActionsMenu } from "@/features/datasets/components/dataset-actions";
import { SourceTypeIcon } from "@/features/datasets/components/file-preview";
import { formatCompact, cn } from "@/lib/utils";
import type { Dataset } from "@/types/api";

export type SortKey = "name" | "row_count" | "column_count" | "created_at" | "status";
export type SortDir = "asc" | "desc";

interface Props {
  datasets: Dataset[];
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (key: SortKey) => void;
  onPreview: (d: Dataset) => void;
  onClean: (d: Dataset) => void;
  onRename: (d: Dataset) => void;
}

const COLUMNS: { key: SortKey; label: string; className?: string; sortable: boolean }[] = [
  { key: "name", label: "Name", sortable: true },
  { key: "status", label: "Status", sortable: true, className: "hidden sm:table-cell" },
  { key: "row_count", label: "Rows", sortable: true, className: "hidden md:table-cell text-right" },
  { key: "column_count", label: "Columns", sortable: true, className: "hidden md:table-cell text-right" },
  { key: "created_at", label: "Uploaded", sortable: true, className: "hidden lg:table-cell" },
];

export function DatasetTable({ datasets, sortKey, sortDir, onSort, onPreview, onClean, onRename }: Props) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              {COLUMNS.map((col) => (
                <th key={col.key} className={cn("px-4 py-3 font-medium", col.className)}>
                  {col.sortable ? (
                    <button
                      onClick={() => onSort(col.key)}
                      className="inline-flex items-center gap-1 transition hover:text-foreground"
                    >
                      {col.label}
                      <SortIcon active={sortKey === col.key} dir={sortDir} />
                    </button>
                  ) : (
                    col.label
                  )}
                </th>
              ))}
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {datasets.map((d) => {
              const isReady = d.status === "cleaned";
              return (
                <tr
                  key={d.id}
                  className="border-b border-border/60 transition-colors last:border-0 hover:bg-accent/50"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <SourceTypeIcon type={d.source_type} className="size-8" />
                      <button
                        onClick={() => isReady && onPreview(d)}
                        disabled={!isReady}
                        className="min-w-0 max-w-[220px] truncate text-left font-medium hover:text-primary disabled:hover:text-foreground"
                      >
                        {d.name}
                      </button>
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 sm:table-cell">
                    <DatasetStatusBadge status={d.status} />
                  </td>
                  <td className="hidden px-4 py-3 text-right tabular-nums md:table-cell">
                    {d.row_count != null ? formatCompact(d.row_count) : "—"}
                  </td>
                  <td className="hidden px-4 py-3 text-right tabular-nums md:table-cell">
                    {d.column_count ?? "—"}
                  </td>
                  <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">
                    {formatDistanceToNow(new Date(d.created_at), { addSuffix: true })}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <DatasetActionsMenu
                      dataset={d}
                      onPreview={onPreview}
                      onClean={onClean}
                      onRename={onRename}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ChevronsUpDown className="size-3 opacity-50" />;
  return dir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />;
}
