import { Database } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Dataset } from "@/types/api";

interface DatasetSelectProps {
  datasets: Dataset[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
  placeholder?: string;
}

/** Native, accessible dataset picker limited to processed (ready) datasets. */
export function DatasetSelect({ datasets, value, onChange, className, placeholder }: DatasetSelectProps) {
  const ready = datasets.filter((d) => d.status === "cleaned");
  return (
    <div className={cn("flex items-center gap-2 rounded-xl border border-border bg-card px-3", className)}>
      <Database className="size-4 shrink-0 text-muted-foreground" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Select dataset"
        className="h-9 min-w-0 flex-1 truncate bg-transparent text-sm outline-none"
      >
        <option value="">{placeholder ?? "Select a dataset…"}</option>
        {ready.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </select>
    </div>
  );
}
