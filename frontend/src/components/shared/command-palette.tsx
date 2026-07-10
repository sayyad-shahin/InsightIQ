import { motion } from "framer-motion";
import { ArrowRight, Database, LogOut, Moon, Search, Sun, Upload, type LucideIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { NAV_ITEMS } from "@/config/nav";
import { useAuth } from "@/providers/auth-provider";
import { useTheme } from "@/providers/theme-provider";
import { cn } from "@/lib/utils";

interface Command {
  id: string;
  label: string;
  icon: LucideIcon;
  group: string;
  keywords?: string;
  run: () => void;
}

export const openCommandPalette = () => window.dispatchEvent(new CustomEvent("open-command-palette"));

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const { toggle, resolvedTheme } = useTheme();
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onCustom = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("open-command-palette", onCustom);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("open-command-palette", onCustom);
    };
  }, []);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setActive(0);
    }
  }, [open]);

  const commands = useMemo<Command[]>(() => {
    const go = (href: string) => () => {
      navigate(href);
      setOpen(false);
    };
    const nav: Command[] = NAV_ITEMS.filter((i) => !i.adminOnly || user?.role === "admin").map((i) => ({
      id: `nav-${i.href}`,
      label: i.title,
      icon: i.icon,
      group: "Navigate",
      run: go(i.href),
    }));
    const actions: Command[] = [
      {
        id: "upload",
        label: "Upload a dataset",
        icon: Upload,
        group: "Actions",
        run: go("/app/datasets?upload=1"),
      },
      {
        id: "new-dataset",
        label: "View datasets",
        icon: Database,
        group: "Actions",
        run: go("/app/datasets"),
      },
      {
        id: "theme",
        label: `Switch to ${resolvedTheme === "dark" ? "light" : "dark"} mode`,
        icon: resolvedTheme === "dark" ? Sun : Moon,
        group: "Preferences",
        run: () => {
          toggle();
          setOpen(false);
        },
      },
      {
        id: "logout",
        label: "Log out",
        icon: LogOut,
        group: "Account",
        run: () => {
          logout();
          navigate("/login");
          setOpen(false);
        },
      },
    ];
    return [...nav, ...actions];
  }, [navigate, logout, toggle, resolvedTheme, user]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => `${c.label} ${c.group} ${c.keywords ?? ""}`.toLowerCase().includes(q));
  }, [commands, query]);

  const grouped = useMemo(() => {
    const map = new Map<string, Command[]>();
    filtered.forEach((c) => map.set(c.group, [...(map.get(c.group) ?? []), c]));
    return Array.from(map.entries());
  }, [filtered]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((a) => Math.min(a + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((a) => Math.max(a - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        filtered[active]?.run();
      }
    },
    [filtered, active],
  );

  let index = -1;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent hideClose className="max-w-xl gap-0 overflow-hidden p-0" onKeyDown={onKeyDown}>
        <div className="flex items-center gap-3 border-b border-border px-4">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            placeholder="Search commands, pages, actions…"
            className="h-14 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <kbd className="hidden rounded-md border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:block">
            ESC
          </kbd>
        </div>
        <div ref={listRef} className="max-h-[340px] overflow-y-auto p-2">
          {filtered.length === 0 && (
            <div className="py-10 text-center text-sm text-muted-foreground">No results found.</div>
          )}
          {grouped.map(([group, items]) => (
            <div key={group} className="mb-1">
              <div className="px-2 py-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {group}
              </div>
              {items.map((cmd) => {
                index += 1;
                const isActive = index === active;
                const Icon = cmd.icon;
                return (
                  <button
                    key={cmd.id}
                    onMouseEnter={() => setActive(index)}
                    onClick={cmd.run}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-2.5 py-2.5 text-left text-sm transition-colors",
                      isActive ? "bg-accent text-accent-foreground" : "text-foreground/80",
                    )}
                  >
                    <Icon className="size-4 text-muted-foreground" />
                    <span className="flex-1">{cmd.label}</span>
                    {isActive && (
                      <motion.span layoutId="cmd-arrow">
                        <ArrowRight className="size-3.5 text-muted-foreground" />
                      </motion.span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
