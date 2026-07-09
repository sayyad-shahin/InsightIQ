import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import type { CleaningOperations } from "@/types/api";

export const datasetKeys = {
  all: ["datasets"] as const,
  detail: (id: string) => ["dataset", id] as const,
  preview: (id: string) => ["dataset", id, "preview"] as const,
  statistics: (id: string) => ["dataset", id, "statistics"] as const,
  quality: (id: string) => ["dataset", id, "quality"] as const,
};

const AUTO_REFRESH_MS = 4000;

export function useDatasets() {
  return useQuery({
    queryKey: datasetKeys.all,
    queryFn: api.datasets.list,
    // Poll while anything is still processing so status badges update live.
    refetchInterval: (query) =>
      (query.state.data ?? []).some((d) => d.status === "uploaded" || d.status === "processing")
        ? AUTO_REFRESH_MS
        : false,
  });
}

export function useDataset(id: string | undefined) {
  return useQuery({
    queryKey: datasetKeys.detail(id ?? ""),
    queryFn: () => api.datasets.get(id!),
    enabled: !!id,
  });
}

export function useDatasetPreview(id: string | undefined, enabled = true) {
  return useQuery({
    queryKey: datasetKeys.preview(id ?? ""),
    queryFn: () => api.datasets.preview(id!),
    enabled: !!id && enabled,
  });
}

export function useDatasetStatistics(id: string | undefined, enabled = true) {
  return useQuery({
    queryKey: datasetKeys.statistics(id ?? ""),
    queryFn: () => api.datasets.statistics(id!),
    enabled: !!id && enabled,
  });
}

function errorMessage(err: unknown, fallback: string) {
  return err instanceof ApiError ? err.message : fallback;
}

export function useDeleteDataset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.datasets.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: datasetKeys.all });
      toast.success("Dataset deleted");
    },
    onError: (err) => toast.error(errorMessage(err, "Could not delete dataset")),
  });
}

export function useRenameDataset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => api.datasets.rename(id, name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: datasetKeys.all });
      toast.success("Dataset renamed");
    },
    onError: (err) => toast.error(errorMessage(err, "Could not rename dataset")),
  });
}

export function useDuplicateDataset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.datasets.duplicate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: datasetKeys.all });
      toast.success("Dataset duplicated");
    },
    onError: (err) => toast.error(errorMessage(err, "Could not duplicate dataset")),
  });
}

export function useApplyCleaning(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ops: CleaningOperations) => api.datasets.cleanApply(id, ops),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: datasetKeys.all });
      qc.invalidateQueries({ queryKey: datasetKeys.detail(id) });
      qc.invalidateQueries({ queryKey: datasetKeys.preview(id) });
      qc.invalidateQueries({ queryKey: datasetKeys.statistics(id) });
      toast.success("Cleaning applied");
    },
    onError: (err) => toast.error(errorMessage(err, "Could not apply cleaning")),
  });
}

export function useUndoCleaning(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.datasets.cleanUndo(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: datasetKeys.all });
      qc.invalidateQueries({ queryKey: datasetKeys.detail(id) });
      qc.invalidateQueries({ queryKey: datasetKeys.preview(id) });
      qc.invalidateQueries({ queryKey: datasetKeys.statistics(id) });
      toast.success("Cleaning reverted");
    },
    onError: (err) => toast.error(errorMessage(err, "Nothing to undo")),
  });
}
