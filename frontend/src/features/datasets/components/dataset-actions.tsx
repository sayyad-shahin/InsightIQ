import { Copy, Download, Eye, MoreHorizontal, Pencil, Sparkles, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDeleteDataset, useDuplicateDataset } from "@/features/datasets/hooks";
import { api } from "@/lib/api";
import type { Dataset } from "@/types/api";

interface Props {
  dataset: Dataset;
  onPreview: (d: Dataset) => void;
  onClean: (d: Dataset) => void;
  onRename: (d: Dataset) => void;
}

export function DatasetActionsMenu({ dataset, onPreview, onClean, onRename }: Props) {
  const duplicate = useDuplicateDataset();
  const remove = useDeleteDataset();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const isReady = dataset.status === "cleaned";

  async function handleDownload() {
    try {
      await api.datasets.download(dataset.id, dataset.name);
    } catch {
      toast.error("Download failed");
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label="Dataset actions">
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onPreview(dataset)} disabled={!isReady}>
            <Eye /> Preview
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onClean(dataset)} disabled={!isReady}>
            <Sparkles /> Clean data
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => onRename(dataset)}>
            <Pencil /> Rename
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => duplicate.mutate(dataset.id)}>
            <Copy /> Duplicate
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleDownload}>
            <Download /> Download
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setConfirmOpen(true)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Delete dataset?"
        description={`"${dataset.name}" and its analyses will be permanently removed. This cannot be undone.`}
        confirmLabel="Delete"
        destructive
        loading={remove.isPending}
        onConfirm={() => remove.mutate(dataset.id, { onSuccess: () => setConfirmOpen(false) })}
      />
    </>
  );
}
