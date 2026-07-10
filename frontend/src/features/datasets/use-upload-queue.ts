import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { Dataset } from "@/types/api";
import { datasetKeys } from "@/features/datasets/hooks";
import { fileKey, validateFile } from "@/features/datasets/upload-utils";

export type QueueStatus = "queued" | "uploading" | "success" | "error" | "cancelled" | "duplicate";

export interface QueueItem {
  id: string;
  file: File;
  status: QueueStatus;
  progress: number;
  error?: string;
  dataset?: Dataset;
}

let counter = 0;
const nextId = () => `q-${Date.now()}-${counter++}`;

export function useUploadQueue(existingNames: string[] = []) {
  const [items, setItems] = useState<QueueItem[]>([]);
  const aborts = useRef<Map<string, () => void>>(new Map());
  const qc = useQueryClient();

  const patch = useCallback((id: string, partial: Partial<QueueItem>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...partial } : it)));
  }, []);

  const start = useCallback(
    (item: QueueItem) => {
      patch(item.id, { status: "uploading", progress: 0, error: undefined });
      const { promise, abort } = api.datasets.createUpload(item.file, (pct) =>
        patch(item.id, { progress: pct }),
      );
      aborts.current.set(item.id, abort);
      promise
        .then((dataset) => {
          patch(item.id, { status: "success", progress: 100, dataset });
          qc.invalidateQueries({ queryKey: datasetKeys.all });
          toast.success(`Uploaded ${item.file.name}`);
        })
        .catch((err: unknown) => {
          const message = err instanceof Error ? err.message : "Upload failed";
          if (message === "Upload cancelled") patch(item.id, { status: "cancelled" });
          else {
            patch(item.id, { status: "error", error: message });
            toast.error(`${item.file.name}: ${message}`);
          }
        })
        .finally(() => aborts.current.delete(item.id));
    },
    [patch, qc],
  );

  const enqueue = useCallback(
    (files: File[]) => {
      const seen = new Set([...items.map((i) => fileKey(i.file))]);
      const nameSet = new Set(existingNames.map((n) => n.toLowerCase()));
      const created: QueueItem[] = [];

      for (const file of files) {
        const validation = validateFile(file);
        const duplicate = seen.has(fileKey(file)) || nameSet.has(file.name.toLowerCase());
        const item: QueueItem = {
          id: nextId(),
          file,
          progress: 0,
          status: !validation.ok ? "error" : duplicate ? "duplicate" : "queued",
          error: !validation.ok
            ? validation.error
            : duplicate
              ? "A dataset with this name already exists"
              : undefined,
        };
        seen.add(fileKey(file));
        created.push(item);
      }

      setItems((prev) => [...created, ...prev]);
      created.filter((i) => i.status === "queued").forEach(start);
    },
    [items, existingNames, start],
  );

  const cancel = useCallback((id: string) => {
    aborts.current.get(id)?.();
  }, []);

  const retry = useCallback(
    (id: string) => {
      const item = items.find((i) => i.id === id);
      if (item) start(item);
    },
    [items, start],
  );

  const remove = useCallback((id: string) => {
    aborts.current.get(id)?.();
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const clearFinished = useCallback(() => {
    setItems((prev) => prev.filter((i) => i.status === "uploading" || i.status === "queued"));
  }, []);

  const reset = useCallback(() => {
    aborts.current.forEach((a) => a());
    aborts.current.clear();
    setItems([]);
  }, []);

  return { items, enqueue, cancel, retry, remove, clearFinished, reset };
}
