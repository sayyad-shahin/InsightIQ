import { motion } from "framer-motion";
import { AlertTriangle, Check, Loader2, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { FilePreview } from "@/features/datasets/components/file-preview";
import type { QueueItem } from "@/features/datasets/use-upload-queue";
import { cn } from "@/lib/utils";

interface Props {
  item: QueueItem;
  onCancel: (id: string) => void;
  onRetry: (id: string) => void;
  onRemove: (id: string) => void;
}

export function UploadProgress({ item, onCancel, onRetry, onRemove }: Props) {
  const { status } = item;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -12 }}
      className="rounded-xl border border-border bg-card p-3"
    >
      <div className="flex items-center gap-3">
        <FilePreview file={item.file} />
        <div className="ml-auto flex items-center gap-1">
          {status === "uploading" && (
            <Button variant="ghost" size="icon-sm" onClick={() => onCancel(item.id)} aria-label="Cancel">
              <X className="size-4" />
            </Button>
          )}
          {(status === "error" || status === "cancelled" || status === "duplicate") && (
            <Button variant="ghost" size="icon-sm" onClick={() => onRetry(item.id)} aria-label="Retry">
              <RotateCcw className="size-4" />
            </Button>
          )}
          {status !== "uploading" && (
            <Button variant="ghost" size="icon-sm" onClick={() => onRemove(item.id)} aria-label="Remove">
              <X className="size-4" />
            </Button>
          )}
          <StatusIcon status={status} />
        </div>
      </div>

      {status === "uploading" && (
        <div className="mt-2.5 flex items-center gap-2">
          <Progress value={item.progress} className="h-1.5" />
          <span className="w-9 text-right text-xs font-medium tabular-nums text-muted-foreground">
            {item.progress}%
          </span>
        </div>
      )}
      {status === "queued" && <p className="mt-2 text-xs text-muted-foreground">Queued…</p>}
      {item.error && (status === "error" || status === "duplicate") && (
        <p className={cn("mt-2 text-xs", status === "duplicate" ? "text-warning" : "text-destructive")}>
          {item.error}
        </p>
      )}
      {status === "success" && item.dataset && (
        <p className="mt-2 text-xs text-success">Uploaded · processing started</p>
      )}
    </motion.div>
  );
}

function StatusIcon({ status }: { status: QueueItem["status"] }) {
  if (status === "uploading" || status === "queued")
    return <Loader2 className="size-4 animate-spin text-primary" />;
  if (status === "success")
    return (
      <span className="grid size-5 place-items-center rounded-full bg-success/15 text-success">
        <Check className="size-3.5" />
      </span>
    );
  if (status === "duplicate") return <AlertTriangle className="size-4 text-warning" />;
  if (status === "error") return <AlertTriangle className="size-4 text-destructive" />;
  return null;
}
