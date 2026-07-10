import { FileText } from "lucide-react";
import { useEffect, useState } from "react";
import { DatasetSelect } from "@/components/shared/dataset-select";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateReport } from "@/features/reports/hooks";
import { useDatasets } from "@/features/datasets/hooks";

export function CreateReportDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const datasets = useDatasets().data ?? [];
  const create = useCreateReport();
  const [datasetId, setDatasetId] = useState("");
  const [title, setTitle] = useState("");

  useEffect(() => {
    if (datasetId) {
      const ds = datasets.find((d) => d.id === datasetId);
      if (ds && !title) setTitle(`${ds.name} — Executive Report`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datasetId]);

  function submit() {
    if (!datasetId || !title.trim()) return;
    create.mutate(
      { dataset_id: datasetId, title: title.trim() },
      {
        onSuccess: () => {
          onOpenChange(false);
          setDatasetId("");
          setTitle("");
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="mb-1 flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-brand-gradient text-white">
              <FileText className="size-5" />
            </div>
            <DialogTitle>Generate report</DialogTitle>
          </div>
          <DialogDescription>Create an executive summary with AI insights from a dataset.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Dataset</Label>
            <DatasetSelect datasets={datasets} value={datasetId} onChange={setDatasetId} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="report-title">Title</Label>
            <Input
              id="report-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Q3 Executive Report"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="gradient"
            onClick={submit}
            loading={create.isPending}
            disabled={!datasetId || !title.trim()}
          >
            Generate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
