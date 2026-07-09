import { useEffect, useRef } from "react";
import { ChatMessage } from "@/features/chat/components/chat-message";
import type { ChartSpec, ChatMessage as ChatMessageType } from "@/types/api";

interface MessageListProps {
  messages: ChatMessageType[];
  pending: { user: string; assistant: string } | null;
  streaming: boolean;
  onRegenerate?: () => void;
}

export function MessageList({ messages, pending, streaming, onRegenerate }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, pending?.assistant, pending?.user]);

  const lastAssistantId = [...messages].reverse().find((m) => m.role === "assistant")?.id;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6">
      {messages.map((m) => (
        <ChatMessage
          key={m.id}
          role={m.role}
          content={m.content}
          chart={m.result_type === "chart" ? (m.result_payload as unknown as ChartSpec) : null}
          createdAt={m.created_at}
          onRegenerate={!pending && !streaming && m.id === lastAssistantId ? onRegenerate : undefined}
        />
      ))}

      {pending && (
        <>
          <ChatMessage role="user" content={pending.user} />
          <ChatMessage role="assistant" content={pending.assistant} streaming />
        </>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
