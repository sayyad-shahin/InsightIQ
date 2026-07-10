import { Download, FileDown, MessageSquare, Menu, Printer, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { LogoMark } from "@/components/brand/logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { ChatComposer } from "@/features/chat/components/chat-composer";
import { ChatSidebar } from "@/features/chat/components/chat-sidebar";
import { MessageList } from "@/features/chat/components/message-list";
import { SuggestedPrompts } from "@/features/chat/components/suggested-prompts";
import { downloadMarkdown, printConversation } from "@/features/chat/export-conversation";
import { useChat, useChats, useCreateChat } from "@/features/chat/hooks";
import { useChatStream } from "@/features/chat/use-chat-stream";
import { useDatasets } from "@/features/datasets/hooks";
import { useAuth } from "@/providers/auth-provider";

export default function ChatPage() {
  const { user } = useAuth();
  const chatsQ = useChats();
  const chats = chatsQ.data ?? [];
  const datasets = (useDatasets().data ?? []).filter((d) => d.status === "cleaned");

  const [activeId, setActiveId] = useState<string | null>(null);
  const [newDatasetId, setNewDatasetId] = useState<string>("");
  const [mobileNav, setMobileNav] = useState(false);
  const [creating, setCreating] = useState(false);

  const detailQ = useChat(activeId ?? undefined);
  const stream = useChatStream();
  const createChat = useCreateChat();

  const messages = detailQ.data?.messages ?? [];
  const activeChat = chats.find((c) => c.id === activeId) ?? detailQ.data ?? null;

  const lastUserMessage = useMemo(
    () => [...messages].reverse().find((m) => m.role === "user")?.content,
    [messages],
  );

  async function handleSend(text: string) {
    if (activeId) {
      stream.send(activeId, text);
      return;
    }
    if (creating) return;
    setCreating(true);
    try {
      const chat = await createChat.mutateAsync({
        title: "New conversation",
        dataset_id: newDatasetId || null,
      });
      setActiveId(chat.id);
      setNewDatasetId("");
      stream.send(chat.id, text);
    } finally {
      setCreating(false);
    }
  }

  function selectChat(id: string) {
    setActiveId(id);
    setMobileNav(false);
  }

  const sidebar = (
    <ChatSidebar
      chats={chats}
      activeId={activeId}
      onSelect={selectChat}
      onNew={() => {
        setActiveId(null);
        setMobileNav(false);
      }}
    />
  );

  return (
    <div className="flex h-[calc(100vh-8rem)] min-h-[520px] gap-4">
      {/* Desktop conversation rail */}
      <aside className="hidden w-72 shrink-0 rounded-2xl border border-border bg-card shadow-soft lg:block">
        {sidebar}
      </aside>

      {/* Mobile drawer */}
      <Dialog open={mobileNav} onOpenChange={setMobileNav}>
        <DialogContent
          hideClose
          className="fixed left-0 top-0 h-full max-w-[300px] translate-x-0 translate-y-0 rounded-none rounded-r-2xl border-y-0 border-l-0 p-0"
        >
          {sidebar}
        </DialogContent>
      </Dialog>

      {/* Main pane */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <Button
            variant="ghost"
            size="icon-sm"
            className="lg:hidden"
            onClick={() => setMobileNav(true)}
            aria-label="Conversations"
          >
            <Menu className="size-4" />
          </Button>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{activeChat ? activeChat.title : "New conversation"}</p>
            {activeChat?.dataset_id && (
              <Badge variant="secondary" className="mt-0.5 gap-1">
                <Sparkles className="size-3" /> Data-aware
              </Badge>
            )}
          </div>
          {activeId && detailQ.data && messages.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Download className="size-4" /> Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => downloadMarkdown(detailQ.data!)}>
                  <FileDown /> Markdown (.md)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => printConversation(detailQ.data!)}>
                  <Printer /> Print / Save as PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {activeId ? (
            detailQ.isLoading ? (
              <div className="mx-auto max-w-3xl space-y-6 p-6">
                <Skeleton className="h-16 rounded-xl" />
                <Skeleton className="h-24 rounded-xl" />
              </div>
            ) : (
              <MessageList
                messages={messages}
                pending={stream.pending}
                streaming={stream.isStreaming}
                onRegenerate={lastUserMessage ? () => stream.send(activeId, lastUserMessage) : undefined}
              />
            )
          ) : (
            <WelcomeScreen
              name={user?.full_name.split(" ")[0]}
              datasets={datasets}
              datasetId={newDatasetId}
              onDatasetChange={setNewDatasetId}
              onPrompt={handleSend}
            />
          )}
        </div>

        {/* Composer */}
        <div className="border-t border-border bg-background/40 p-3">
          <div className="mx-auto max-w-3xl">
            <ChatComposer
              onSend={handleSend}
              onStop={stream.stop}
              streaming={stream.isStreaming}
              disabled={creating}
              placeholder={
                activeChat?.dataset_id || newDatasetId
                  ? "Ask anything about your data…"
                  : "Ask a question, or attach a dataset for analysis…"
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function WelcomeScreen({
  name,
  datasets,
  datasetId,
  onDatasetChange,
  onPrompt,
}: {
  name?: string;
  datasets: { id: string; name: string }[];
  datasetId: string;
  onDatasetChange: (id: string) => void;
  onPrompt: (prompt: string) => void;
}) {
  return (
    <div className="mx-auto flex h-full max-w-2xl flex-col items-center justify-center px-4 py-8 text-center">
      <div className="mb-4 grid size-14 place-items-center rounded-2xl bg-brand-gradient shadow-glow">
        <LogoMark className="size-14 !bg-transparent !shadow-none" />
      </div>
      <h1 className="text-2xl font-bold tracking-tight">
        {name ? `Hi ${name}, ` : ""}what would you like to know?
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Ask questions in plain English and get grounded answers with charts.
      </p>

      {datasets.length > 0 && (
        <div className="mt-5 flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2">
          <MessageSquare className="size-4 text-muted-foreground" />
          <label htmlFor="ds" className="text-sm text-muted-foreground">
            Analyze
          </label>
          <select
            id="ds"
            value={datasetId}
            onChange={(e) => onDatasetChange(e.target.value)}
            className="max-w-[220px] truncate rounded-lg border border-input bg-background px-2 py-1 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">No dataset (general chat)</option>
            {datasets.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="mt-7 w-full">
        <SuggestedPrompts onSelect={onPrompt} />
      </div>
    </div>
  );
}
