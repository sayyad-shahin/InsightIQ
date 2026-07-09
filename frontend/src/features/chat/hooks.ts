import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";

export const chatKeys = {
  all: ["chats"] as const,
  detail: (id: string) => ["chat", id] as const,
};

export function useChats() {
  return useQuery({ queryKey: chatKeys.all, queryFn: api.chats.list });
}

export function useChat(id: string | undefined) {
  return useQuery({
    queryKey: chatKeys.detail(id ?? ""),
    queryFn: () => api.chats.get(id!),
    enabled: !!id,
  });
}

function errMsg(e: unknown, fallback: string) {
  return e instanceof ApiError ? e.message : fallback;
}

export function useCreateChat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { title?: string; dataset_id?: string | null }) => api.chats.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: chatKeys.all }),
    onError: (e) => toast.error(errMsg(e, "Could not create chat")),
  });
}

export function useRenameChat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) => api.chats.rename(id, title),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: chatKeys.all });
      toast.success("Conversation renamed");
    },
    onError: (e) => toast.error(errMsg(e, "Could not rename")),
  });
}

export function useDeleteChat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.chats.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: chatKeys.all });
      toast.success("Conversation deleted");
    },
    onError: (e) => toast.error(errMsg(e, "Could not delete")),
  });
}

// --- Client-side pinning (no backend column needed) ------------------------

const PIN_KEY = "iq_pinned_chats";
const listeners = new Set<() => void>();

function readPins(): string[] {
  try {
    return JSON.parse(localStorage.getItem(PIN_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function writePins(ids: string[]) {
  localStorage.setItem(PIN_KEY, JSON.stringify(ids));
  listeners.forEach((l) => l());
}

export function usePinnedChats() {
  const subscribe = useCallback((cb: () => void) => {
    listeners.add(cb);
    return () => listeners.delete(cb);
  }, []);
  const pins = useSyncExternalStore(subscribe, () => localStorage.getItem(PIN_KEY) ?? "[]");
  const pinnedIds: string[] = JSON.parse(pins);

  const toggle = useCallback((id: string) => {
    const current = readPins();
    writePins(current.includes(id) ? current.filter((p) => p !== id) : [...current, id]);
  }, []);

  return { pinnedIds, isPinned: (id: string) => pinnedIds.includes(id), toggle };
}
