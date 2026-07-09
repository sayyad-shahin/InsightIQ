import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";

export const reportKeys = {
  all: ["reports"] as const,
  detail: (id: string) => ["report", id] as const,
};

export function useReports() {
  return useQuery({ queryKey: reportKeys.all, queryFn: () => api.reports.list() });
}

export function useReport(id: string | undefined) {
  return useQuery({
    queryKey: reportKeys.detail(id ?? ""),
    queryFn: () => api.reports.get(id!),
    enabled: !!id,
    // Reports are generated asynchronously — poll until the sections arrive.
    refetchInterval: (q) => (q.state.data && q.state.data.sections == null ? 2000 : false),
  });
}

export function useCreateReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { dataset_id: string; title: string }) => api.reports.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: reportKeys.all });
      toast.success("Report generated");
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Could not generate report"),
  });
}

export function useDeleteReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.reports.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: reportKeys.all });
      toast.success("Report deleted");
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Could not delete report"),
  });
}
