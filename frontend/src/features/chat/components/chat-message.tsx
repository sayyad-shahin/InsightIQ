import { format } from "date-fns";
import { motion } from "framer-motion";
import { Check, Copy, RefreshCw } from "lucide-react";
import { memo, useState } from "react";
import { toast } from "sonner";
import { LogoMark } from "@/components/brand/logo";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ChatChart } from "@/features/chat/components/chat-chart";
import { ChatMarkdown } from "@/features/chat/components/chat-markdown";
import { TypingIndicator } from "@/features/chat/components/typing-indicator";
import { useAuth } from "@/providers/auth-provider";
import { initials } from "@/lib/utils";
import type { ChartSpec } from "@/types/api";

export interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  chart?: ChartSpec | null;
  createdAt?: string;
  streaming?: boolean;
  onRegenerate?: () => void;
}

export const ChatMessage = memo(function ChatMessage({
  role,
  content,
  chart,
  createdAt,
  streaming,
  onRegenerate,
}: ChatMessageProps) {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);
  const isUser = role === "user";

  function copy() {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cnRow(isUser)}
    >
      {!isUser && (
        <div className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl bg-brand-gradient shadow-soft">
          <LogoMark className="size-8 !bg-transparent !shadow-none" />
        </div>
      )}

      <div className={isUser ? "flex max-w-[85%] flex-col items-end" : "min-w-0 flex-1"}>
        <div
          className={
            isUser
              ? "rounded-2xl rounded-tr-sm bg-brand-gradient px-4 py-2.5 text-sm text-white shadow-soft"
              : "min-w-0"
          }
        >
          {isUser ? (
            <p className="whitespace-pre-wrap break-words">{content}</p>
          ) : content ? (
            <ChatMarkdown content={content} />
          ) : (
            <TypingIndicator />
          )}
          {!isUser && chart && <ChatChart spec={chart} />}
          {!isUser && streaming && content && <TypingIndicator />}
        </div>

        <div className="mt-1 flex items-center gap-2 px-1">
          {createdAt && (
            <span className="text-[11px] text-muted-foreground">{format(new Date(createdAt), "HH:mm")}</span>
          )}
          {!isUser && !streaming && content && (
            <>
              <button
                onClick={copy}
                className="text-muted-foreground transition hover:text-foreground"
                aria-label="Copy response"
              >
                {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
              </button>
              {onRegenerate && (
                <button
                  onClick={onRegenerate}
                  className="text-muted-foreground transition hover:text-foreground"
                  aria-label="Regenerate response"
                >
                  <RefreshCw className="size-3.5" />
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {isUser && (
        <Avatar className="mt-0.5 size-8 shrink-0">
          <AvatarFallback className="text-[11px]">{initials(user?.full_name ?? "U")}</AvatarFallback>
        </Avatar>
      )}
    </motion.div>
  );
});

function cnRow(isUser: boolean) {
  return `flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`;
}
