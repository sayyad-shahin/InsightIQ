import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRenameDataset } from "@/features/datasets/hooks";
import type { Dataset } from "@/types/api";

interface RenameDialogProps {
  dataset: Dataset | null;
  onOpenChange: (open: boolean) => void;
}

export function RenameDialog({ dataset, onOpenChange }: RenameDialogProps) {
  const rename = useRenameDataset();
  const [name, setName] = useState("");

  useEffect(() => {
    if (dataset) setName(dataset.name);
  }, [dataset]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!dataset || !name.trim()) return;
    rename.mutate({ id: dataset.id, name: name.trim() }, { onSuccess: () => onOpenChange(false) });
  }

  return (
    <Dialog open={!!dataset} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Rename dataset</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="dataset-name">Name</Label>
            <Input id="dataset-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={rename.isPending} disabled={!name.trim()}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
