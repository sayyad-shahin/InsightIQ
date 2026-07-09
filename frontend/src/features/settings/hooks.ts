import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import type { UserSettings } from "@/types/api";

export const settingsKeys = { me: ["settings"] as const };

export function useSettings() {
  return useQuery({ queryKey: settingsKeys.me, queryFn: api.settings.get });
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<UserSettings>) => api.settings.update(data),
    onSuccess: (updated) => {
      qc.setQueryData(settingsKeys.me, updated);
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Could not save settings"),
  });
}
