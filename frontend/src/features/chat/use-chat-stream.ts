import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { chatKeys } from "@/features/chat/hooks";

export interface PendingExchange {
  user: string;
  assistant: string;
}

/**
 * Drives a streamed assistant reply for a chat: shows an optimistic user
 * message, appends streamed tokens to a pending assistant bubble, then
 * reconciles with the persisted messages (including any chart) on completion.
 */
export function useChatStream() {
  const qc = useQueryClient();
  const [pending, setPending] = useState<PendingExchange | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const send = useCallback(
    async (chatId: string, content: string) => {
      if (!chatId || isStreaming) return;
      setPending({ user: content, assistant: "" });
      setIsStreaming(true);
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        await api.chats.streamMessage(
          chatId,
          content,
          {
            onToken: (chunk) => setPending((p) => (p ? { ...p, assistant: p.assistant + chunk } : p)),
            onDone: () => {},
          },
          controller.signal,
        );
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          toast.error("The assistant response failed. Please try again.");
        }
      } finally {
        // The full message is already persisted server-side — refetch to get it
        // (with chart payload), then drop the optimistic bubbles.
        await qc.invalidateQueries({ queryKey: chatKeys.detail(chatId) });
        qc.invalidateQueries({ queryKey: chatKeys.all });
        setIsStreaming(false);
        setPending(null);
        abortRef.current = null;
      }
    },
    [isStreaming, qc],
  );

  const stop = useCallback(() => abortRef.current?.abort(), []);

  return { pending, isStreaming, send, stop };
}
