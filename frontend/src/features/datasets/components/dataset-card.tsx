import { formatDistanceToNow } from "date-fns";
import { motion } from "framer-motion";
import { Columns3, Rows3 } from "lucide-react";
import { DatasetStatusBadge } from "@/components/shared/status-badge";
import { DatasetActionsMenu } from "@/features/datasets/components/dataset-actions";
import { SourceTypeIcon } from "@/features/datasets/components/file-preview";
import { formatCompact } from "@/lib/utils";
import type { Dataset } from "@/types/api";

interface Props {
  dataset: Dataset;
  index: number;
  onPreview: (d: Dataset) => void;
  onClean: (d: Dataset) => void;
  onRename: (d: Dataset) => void;
}

export function DatasetCard({ dataset, index, onPreview, onClean, onRename }: Props) {
  const isReady = dataset.status === "cleaned";
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.3) }}
      className="group relative flex flex-col rounded-2xl border border-border bg-card p-4 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-soft-lg"
    >
      <div className="flex items-start gap-3">
        <SourceTypeIcon type={dataset.source_type} />
        <button
          onClick={() => isReady && onPreview(dataset)}
          className="min-w-0 flex-1 text-left"
          disabled={!isReady}
        >
          <p className="truncate font-semibold group-hover:text-primary">{dataset.name}</p>
          <p className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(dataset.created_at), { addSuffix: true })}
          </p>
        </button>
        <DatasetActionsMenu dataset={dataset} onPreview={onPreview} onClean={onClean} onRename={onRename} />
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div className="flex gap-4 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Rows3 className="size-3.5" />
            {dataset.row_count != null ? formatCompact(dataset.row_count) : "—"}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Columns3 className="size-3.5" />
            {dataset.column_count ?? "—"}
          </span>
        </div>
        <DatasetStatusBadge status={dataset.status} />
      </div>

      {dataset.status === "error" && dataset.error_message && (
        <p className="mt-3 line-clamp-2 rounded-lg bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive">
          {dataset.error_message}
        </p>
      )}
    </motion.div>
  );
}
