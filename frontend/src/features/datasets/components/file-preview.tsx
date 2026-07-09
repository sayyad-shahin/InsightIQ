import { Database, FileSpreadsheet, FileText, type LucideIcon } from "lucide-react";
import { detectSourceType } from "@/features/datasets/upload-utils";
import { formatBytes } from "@/lib/utils";
import type { SourceType } from "@/types/api";

const ICONS: Record<SourceType, LucideIcon> = {
  csv: FileSpreadsheet,
  excel: FileSpreadsheet,
  pdf: FileText,
  sql: Database,
};

const TINTS: Record<SourceType, string> = {
  csv: "bg-success/12 text-success",
  excel: "bg-success/12 text-success",
  pdf: "bg-destructive/12 text-destructive",
  sql: "bg-primary/12 text-primary",
};

export function SourceTypeIcon({ type, className }: { type: SourceType; className?: string }) {
  const Icon = ICONS[type];
  return (
    <div className={`grid size-10 shrink-0 place-items-center rounded-xl ${TINTS[type]} ${className ?? ""}`}>
      <Icon className="size-5" />
    </div>
  );
}

export function FilePreview({ file }: { file: File }) {
  const type = detectSourceType(file.name);
  return (
    <div className="flex min-w-0 items-center gap-3">
      {type ? (
        <SourceTypeIcon type={type} />
      ) : (
        <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground">
          <FileText className="size-5" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{file.name}</p>
        <p className="text-xs text-muted-foreground">
          {formatBytes(file.size)}
          {type ? ` · ${type.toUpperCase()}` : ""}
        </p>
      </div>
    </div>
  );
}
