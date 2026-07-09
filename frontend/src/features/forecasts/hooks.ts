import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import type { ForecastModelType } from "@/types/api";

export const forecastKeys = {
  list: (datasetId?: string) => ["forecasts", datasetId ?? "all"] as const,
  detail: (id: string) => ["forecast", id] as const,
};

export function useForecasts(datasetId?: string) {
  return useQuery({
    queryKey: forecastKeys.list(datasetId),
    queryFn: () => api.forecasts.list(datasetId),
    refetchInterval: (q) =>
      (q.state.data ?? []).some((f) => f.status === "queued" || f.status === "running") ? 3000 : false,
  });
}

export function useForecast(id: string | undefined) {
  return useQuery({
    queryKey: forecastKeys.detail(id ?? ""),
    queryFn: () => api.forecasts.get(id!),
    enabled: !!id,
    refetchInterval: (q) =>
      q.state.data && (q.state.data.status === "queued" || q.state.data.status === "running") ? 2000 : false,
  });
}

export function useCreateForecast() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      dataset_id: string;
      target_column: string;
      model_type?: ForecastModelType;
      horizon_periods?: number;
    }) => api.forecasts.create(data),
    onSuccess: (forecast) => {
      qc.invalidateQueries({ queryKey: ["forecasts"] });
      qc.invalidateQueries({ queryKey: forecastKeys.detail(forecast.id) });
      toast.success("Forecast started");
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Could not start forecast"),
  });
}

export function useDeleteForecast() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.forecasts.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["forecasts"] });
      toast.success("Forecast deleted");
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Could not delete forecast"),
  });
}
