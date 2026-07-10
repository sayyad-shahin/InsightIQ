import { Badge } from "@/components/ui/badge";
import type { DatasetStatus, ForecastStatus } from "@/types/api";
import { cn } from "@/lib/utils";

const DATASET_MAP: Record<
  DatasetStatus,
  { label: string; variant: "default" | "success" | "warning" | "destructive" }
> = {
  uploaded: { label: "Uploaded", variant: "default" },
  processing: { label: "Processing", variant: "warning" },
  cleaned: { label: "Ready", variant: "success" },
  error: { label: "Error", variant: "destructive" },
};

const FORECAST_MAP: Record<
  ForecastStatus,
  { label: string; variant: "default" | "success" | "warning" | "destructive" }
> = {
  queued: { label: "Queued", variant: "default" },
  running: { label: "Running", variant: "warning" },
  done: { label: "Done", variant: "success" },
  failed: { label: "Failed", variant: "destructive" },
};

export function DatasetStatusBadge({ status }: { status: DatasetStatus }) {
  const s = DATASET_MAP[status];
  return (
    <Badge variant={s.variant}>
      <span className={cn("size-1.5 rounded-full bg-current", status === "processing" && "animate-pulse")} />
      {s.label}
    </Badge>
  );
}

export function ForecastStatusBadge({ status }: { status: ForecastStatus }) {
  const s = FORECAST_MAP[status];
  return (
    <Badge variant={s.variant}>
      <span className={cn("size-1.5 rounded-full bg-current", status === "running" && "animate-pulse")} />
      {s.label}
    </Badge>
  );
}
