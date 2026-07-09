import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import type { UserRole } from "@/types/api";

export function useAdminStats() {
  return useQuery({ queryKey: ["admin", "stats"], queryFn: api.admin.stats });
}

export function useUsers() {
  return useQuery({ queryKey: ["admin", "users"], queryFn: api.users.list });
}

export function useAuditLogs(limit: number, offset: number) {
  return useQuery({
    queryKey: ["admin", "audit", limit, offset],
    queryFn: () => api.audit.list(limit, offset),
    placeholderData: (prev) => prev,
  });
}

export function useUpdateRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: UserRole }) => api.users.updateRole(userId, role),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      toast.success("Role updated");
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Could not update role"),
  });
}
