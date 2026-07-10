import { formatDistanceToNow } from "date-fns";
import { History } from "lucide-react";
import { DatasetStatusBadge } from "@/components/shared/status-badge";
import { SourceTypeIcon } from "@/features/datasets/components/file-preview";
import type { Dataset } from "@/types/api";

export function UploadHistory({ datasets }: { datasets: Dataset[] }) {
  const recent = [...datasets].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)).slice(0, 5);

  if (recent.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <History className="size-3.5" /> Recent uploads
      </div>
      <div className="space-y-1.5">
        {recent.map((d) => (
          <div key={d.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-2.5">
            <SourceTypeIcon type={d.source_type} className="size-9" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{d.name}</p>
              <p className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(d.created_at), { addSuffix: true })}
              </p>
            </div>
            <DatasetStatusBadge status={d.status} />
          </div>
        ))}
      </div>
    </div>
  );
}
