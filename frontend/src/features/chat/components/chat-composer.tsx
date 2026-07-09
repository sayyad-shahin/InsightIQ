import { ArrowUp, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface ChatComposerProps {
  onSend: (text: string) => void;
  onStop?: () => void;
  streaming?: boolean;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatComposer({ onSend, onStop, streaming, disabled, placeholder }: ChatComposerProps) {
  const [value, setValue] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  // Auto-grow the textarea up to a cap.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [value]);

  function submit() {
    const text = value.trim();
    if (!text || streaming || disabled) return;
    onSend(text);
    setValue("");
  }

  return (
    <div className="glass-strong rounded-2xl border p-2 shadow-soft-lg">
      <div className="flex items-end gap-2">
        <textarea
          ref={ref}
          rows={1}
          value={value}
          disabled={disabled}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={placeholder ?? "Ask anything about your data…"}
          className="max-h-[200px] flex-1 resize-none bg-transparent px-2.5 py-2 text-sm outline-none placeholder:text-muted-foreground disabled:opacity-50"
        />
        {streaming ? (
          <button
            onClick={onStop}
            aria-label="Stop generating"
            className="grid size-9 shrink-0 place-items-center rounded-xl bg-foreground text-background transition hover:opacity-90"
          >
            <Square className="size-3.5 fill-current" />
          </button>
        ) : (
          <button
            onClick={submit}
            disabled={!value.trim() || disabled}
            aria-label="Send message"
            className={cn(
              "grid size-9 shrink-0 place-items-center rounded-xl transition-all",
              value.trim() && !disabled
                ? "bg-brand-gradient text-white shadow-soft hover:shadow-glow"
                : "bg-muted text-muted-foreground",
            )}
          >
            <ArrowUp className="size-4" />
          </button>
        )}
      </div>
      <p className="px-2 pb-0.5 pt-1 text-[11px] text-muted-foreground">
        Enter to send · Shift+Enter for new line
      </p>
    </div>
  );
}
