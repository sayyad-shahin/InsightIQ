import { AnimatePresence } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { UploadDropzone } from "@/features/datasets/components/upload-dropzone";
import { UploadHistory } from "@/features/datasets/components/upload-history";
import { UploadProgress } from "@/features/datasets/components/upload-progress";
import { useUploadQueue } from "@/features/datasets/use-upload-queue";
import type { Dataset } from "@/types/api";

interface UploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  datasets: Dataset[];
}

export function UploadDialog({ open, onOpenChange, datasets }: UploadDialogProps) {
  const existingNames = datasets.map((d) => d.name);
  const queue = useUploadQueue(existingNames);

  const active = queue.items.filter((i) => i.status === "uploading" || i.status === "queued").length;
  const done = queue.items.filter((i) => i.status === "success").length;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) queue.reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Upload datasets</DialogTitle>
          <DialogDescription>
            CSV, Excel, PDF, or SQL. Files are validated and profiled automatically.
          </DialogDescription>
        </DialogHeader>

        <UploadDropzone onFiles={queue.enqueue} compact={queue.items.length > 0} />

        {queue.items.length > 0 && (
          <ScrollArea className="max-h-[240px] pr-3">
            <AnimatePresence initial={false} mode="popLayout">
              <div className="space-y-2">
                {queue.items.map((item) => (
                  <UploadProgress
                    key={item.id}
                    item={item}
                    onCancel={queue.cancel}
                    onRetry={queue.retry}
                    onRemove={queue.remove}
                  />
                ))}
              </div>
            </AnimatePresence>
          </ScrollArea>
        )}

        {queue.items.length === 0 && <UploadHistory datasets={datasets} />}

        {queue.items.length > 0 && (
          <div className="flex items-center justify-between border-t border-border pt-4">
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              {done > 0 && <CheckCircle2 className="size-4 text-success" />}
              {active > 0 ? `${active} uploading…` : done > 0 ? `${done} uploaded` : "Ready"}
            </p>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={queue.clearFinished} disabled={active > 0}>
                Clear finished
              </Button>
              <Button size="sm" onClick={() => onOpenChange(false)} disabled={active > 0}>
                Done
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
