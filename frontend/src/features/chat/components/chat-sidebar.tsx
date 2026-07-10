import { MessageSquarePlus, MoreHorizontal, Pencil, Pin, PinOff, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { useDeleteChat, usePinnedChats, useRenameChat } from "@/features/chat/hooks";
import { cn } from "@/lib/utils";
import type { Chat } from "@/types/api";

interface ChatSidebarProps {
  chats: Chat[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
}

export function ChatSidebar({ chats, activeId, onSelect, onNew }: ChatSidebarProps) {
  const [search, setSearch] = useState("");
  const { pinnedIds, toggle } = usePinnedChats();
  const del = useDeleteChat();
  const rename = useRenameChat();
  const [renameTarget, setRenameTarget] = useState<Chat | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Chat | null>(null);

  const { pinned, recent } = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q ? chats.filter((c) => c.title.toLowerCase().includes(q)) : chats;
    return {
      pinned: filtered.filter((c) => pinnedIds.includes(c.id)),
      recent: filtered.filter((c) => !pinnedIds.includes(c.id)),
    };
  }, [chats, search, pinnedIds]);

  function openRename(chat: Chat) {
    setRenameTarget(chat);
    setRenameValue(chat.title);
  }

  return (
    <div className="flex h-full flex-col gap-3 p-3">
      <Button variant="gradient" className="w-full" onClick={onNew}>
        <MessageSquarePlus className="size-4" /> New chat
      </Button>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search chats…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 pl-9"
        />
      </div>

      <div className="no-scrollbar flex-1 space-y-4 overflow-y-auto">
        {chats.length === 0 && (
          <p className="px-1 py-8 text-center text-sm text-muted-foreground">No conversations yet.</p>
        )}
        {pinned.length > 0 && (
          <Section title="Pinned">
            {pinned.map((c) => (
              <Item
                key={c.id}
                chat={c}
                active={c.id === activeId}
                pinned
                onSelect={onSelect}
                onPin={toggle}
                onRename={openRename}
                onDelete={setDeleteTarget}
              />
            ))}
          </Section>
        )}
        {recent.length > 0 && (
          <Section title={pinned.length > 0 ? "Recent" : undefined}>
            {recent.map((c) => (
              <Item
                key={c.id}
                chat={c}
                active={c.id === activeId}
                pinned={false}
                onSelect={onSelect}
                onPin={toggle}
                onRename={openRename}
                onDelete={setDeleteTarget}
              />
            ))}
          </Section>
        )}
      </div>

      {/* Rename dialog */}
      <Dialog open={!!renameTarget} onOpenChange={(o) => !o && setRenameTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Rename conversation</DialogTitle>
          </DialogHeader>
          <Input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} autoFocus />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRenameTarget(null)}>
              Cancel
            </Button>
            <Button
              loading={rename.isPending}
              disabled={!renameValue.trim()}
              onClick={() =>
                renameTarget &&
                rename.mutate(
                  { id: renameTarget.id, title: renameValue.trim() },
                  { onSuccess: () => setRenameTarget(null) },
                )
              }
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Delete conversation?"
        description={`"${deleteTarget?.title}" will be permanently removed.`}
        confirmLabel="Delete"
        destructive
        loading={del.isPending}
        onConfirm={() =>
          deleteTarget && del.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) })
        }
      />
    </div>
  );
}

function Section({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      {title && (
        <p className="px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {title}
        </p>
      )}
      {children}
    </div>
  );
}

interface ItemProps {
  chat: Chat;
  active: boolean;
  pinned: boolean;
  onSelect: (id: string) => void;
  onPin: (id: string) => void;
  onRename: (chat: Chat) => void;
  onDelete: (chat: Chat) => void;
}

function Item({ chat, active, pinned, onSelect, onPin, onRename, onDelete }: ItemProps) {
  return (
    <div
      className={cn(
        "group flex items-center gap-1 rounded-xl px-2 transition-colors",
        active ? "bg-accent" : "hover:bg-accent/60",
      )}
    >
      <button
        onClick={() => onSelect(chat.id)}
        className="flex min-w-0 flex-1 items-center gap-2 py-2 text-left"
      >
        {pinned && <Pin className="size-3 shrink-0 text-primary" />}
        <span className={cn("truncate text-sm", active ? "font-medium" : "text-foreground/80")}>
          {chat.title}
        </span>
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="shrink-0 rounded-md p-1 text-muted-foreground opacity-0 transition hover:text-foreground group-hover:opacity-100 data-[state=open]:opacity-100"
            aria-label="Chat options"
          >
            <MoreHorizontal className="size-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onPin(chat.id)}>
            {pinned ? <PinOff /> : <Pin />} {pinned ? "Unpin" : "Pin"}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onRename(chat)}>
            <Pencil /> Rename
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => onDelete(chat)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
