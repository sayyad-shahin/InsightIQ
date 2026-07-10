import { useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowRight, Eye, Sparkles, Undo2, Wand2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useApplyCleaning, useUndoCleaning } from "@/features/datasets/hooks";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { CleaningOperations, CleaningSummary, Dataset } from "@/types/api";

const DEFAULT_OPS: CleaningOperations = {
  remove_duplicates: true,
  fill_missing: true,
  drop_empty_rows: true,
  convert_types: false,
  normalize_dates: false,
  trim_whitespace: true,
  fill_strategy: "auto",
};

const TOGGLES: { key: keyof CleaningOperations; label: string; desc: string }[] = [
  { key: "remove_duplicates", label: "Remove duplicates", desc: "Drop fully duplicated rows" },
  { key: "fill_missing", label: "Fill missing values", desc: "Impute gaps by column type" },
  { key: "drop_empty_rows", label: "Remove empty rows", desc: "Drop rows that are entirely blank" },
  { key: "trim_whitespace", label: "Trim whitespace", desc: "Strip leading/trailing spaces" },
  { key: "convert_types", label: "Convert data types", desc: "Coerce numeric-looking text to numbers" },
  { key: "normalize_dates", label: "Normalize dates", desc: "Parse date columns to YYYY-MM-DD" },
];

interface Props {
  dataset: Dataset | null;
  onOpenChange: (open: boolean) => void;
}

export function DataCleaningDialog({ dataset, onOpenChange }: Props) {
  const [ops, setOps] = useState<CleaningOperations>(DEFAULT_OPS);
  const apply = useApplyCleaning(dataset?.id ?? "");
  const undo = useUndoCleaning(dataset?.id ?? "");

  const previewMut = useMutation({
    mutationFn: (o: CleaningOperations) => api.datasets.cleanPreview(dataset!.id, o),
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Preview failed"),
  });
  const summary = previewMut.data?.summary;

  function toggle(key: keyof CleaningOperations) {
    setOps((prev) => ({ ...prev, [key]: !prev[key] }));
    previewMut.reset();
  }

  return (
    <Dialog open={!!dataset} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="grid size-9 place-items-center rounded-xl bg-brand-gradient text-white">
              <Wand2 className="size-4" />
            </div>
            <div>
              <DialogTitle>Smart data cleaning</DialogTitle>
              <DialogDescription>Preview changes before applying. You can undo afterwards.</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="grid gap-5 md:grid-cols-2">
          {/* Options */}
          <div className="space-y-2">
            {TOGGLES.map((t) => (
              <label
                key={t.key}
                className="flex cursor-pointer items-start justify-between gap-3 rounded-xl border border-border p-3 transition hover:bg-accent/40"
              >
                <div>
                  <p className="text-sm font-medium">{t.label}</p>
                  <p className="text-xs text-muted-foreground">{t.desc}</p>
                </div>
                <Switch checked={ops[t.key] as boolean} onCheckedChange={() => toggle(t.key)} />
              </label>
            ))}

            {ops.fill_missing && (
              <div className="flex items-center justify-between rounded-xl border border-border p-3">
                <p className="text-sm font-medium">Fill strategy</p>
                <select
                  value={ops.fill_strategy}
                  onChange={(e) => {
                    setOps((p) => ({
                      ...p,
                      fill_strategy: e.target.value as CleaningOperations["fill_strategy"],
                    }));
                    previewMut.reset();
                  }}
                  className="h-9 rounded-lg border border-input bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="auto">Auto (median)</option>
                  <option value="mean">Mean</option>
                  <option value="median">Median</option>
                  <option value="zero">Zero</option>
                </select>
              </div>
            )}
          </div>

          {/* Result */}
          <div className="flex flex-col rounded-xl border border-border bg-muted/20 p-4">
            {summary ? (
              <CleaningResult summary={summary} />
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center text-center">
                <Eye className="mb-2 size-6 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Preview the effect of your selected operations before applying.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
          <Button variant="ghost" onClick={() => undo.mutate()} loading={undo.isPending}>
            <Undo2 className="size-4" /> Undo cleaning
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => previewMut.mutate(ops)} loading={previewMut.isPending}>
              <Eye className="size-4" /> Preview changes
            </Button>
            <Button
              variant="gradient"
              loading={apply.isPending}
              onClick={() => apply.mutate(ops, { onSuccess: () => onOpenChange(false) })}
            >
              <Sparkles className="size-4" /> Apply cleaning
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Delta({ label, before, after }: { label: string; before: number; after: number }) {
  const improved = after < before;
  return (
    <div className="flex items-center justify-between rounded-lg bg-card px-3 py-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="flex items-center gap-1.5 text-sm font-medium tabular-nums">
        {before}
        <ArrowRight className="size-3 text-muted-foreground" />
        <span className={cn(improved ? "text-success" : "text-foreground")}>{after}</span>
      </span>
    </div>
  );
}

function CleaningResult({ summary }: { summary: CleaningSummary }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Preview</p>
      <Delta label="Rows" before={summary.rows_before} after={summary.rows_after} />
      <Delta label="Missing cells" before={summary.missing_before} after={summary.missing_after} />
      <Delta label="Duplicates" before={summary.duplicates_before} after={summary.duplicates_after} />
      <div className="pt-1">
        <p className="mb-1 text-xs font-medium text-muted-foreground">Operations</p>
        <ul className="space-y-1">
          {summary.operations_applied.map((op, i) => (
            <li key={i} className="flex items-start gap-1.5 text-xs text-foreground/80">
              <Sparkles className="mt-0.5 size-3 shrink-0 text-primary" />
              {op}
            </li>
          ))}
        </ul>
      </div>
    </motion.div>
  );
}
