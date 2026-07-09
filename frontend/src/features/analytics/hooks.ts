import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useAnalytics(
  datasetId: string | undefined,
  opts?: { measure?: string; dimension?: string },
) {
  return useQuery({
    queryKey: ["analytics", datasetId, opts?.measure ?? "", opts?.dimension ?? ""],
    queryFn: () => api.datasets.analytics(datasetId!, opts),
    enabled: !!datasetId,
    placeholderData: (prev) => prev, // keep the previous view while drilling down
  });
}
