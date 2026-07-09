import { motion } from "framer-motion";
import { DatasetStatusBadge } from "@/components/shared/status-badge";
import { formatCompact } from "@/lib/utils";
import type { Dataset } from "@/types/api";

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-muted/30 p-3">
      <p className="text-lg font-bold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

export function DatasetSummary({ dataset }: { dataset: Dataset }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="truncate font-semibold">{dataset.name}</p>
        <DatasetStatusBadge status={dataset.status} />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Rows" value={dataset.row_count != null ? formatCompact(dataset.row_count) : "—"} />
        <Stat label="Columns" value={dataset.column_count ?? "—"} />
        <Stat label="Type" value={dataset.source_type.toUpperCase()} />
        <Stat label="Status" value={<span className="capitalize">{dataset.status}</span>} />
      </div>
    </motion.div>
  );
}
