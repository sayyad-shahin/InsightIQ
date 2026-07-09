import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { NavLink } from "react-router-dom";
import { Logo } from "@/components/brand/logo";
import { NAV_ITEMS } from "@/config/nav";
import { useAuth } from "@/providers/auth-provider";
import { cn } from "@/lib/utils";

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const { user } = useAuth();
  const items = NAV_ITEMS.filter((i) => !i.adminOnly || user?.role === "admin");

  return (
    <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
      {items.map((item) => (
        <NavLink
          key={item.href}
          to={item.href}
          end={item.href === "/app"}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
              isActive ? "text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )
          }
        >
          {({ isActive }) => (
            <>
              {isActive && (
                <motion.span
                  layoutId="sidebar-active"
                  className="absolute inset-0 -z-10 rounded-xl bg-accent"
                  transition={{ type: "spring", stiffness: 400, damping: 32 }}
                />
              )}
              <item.icon className="size-[18px] shrink-0" />
              {item.title}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

export function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-card/50 backdrop-blur-xl lg:flex">
      <div className="flex h-16 items-center px-5">
        <Logo />
      </div>
      <SidebarNav />
      <UpgradeCard />
    </aside>
  );
}

function UpgradeCard() {
  return (
    <div className="m-3 overflow-hidden rounded-2xl border border-border bg-mesh p-4">
      <div className="flex items-center gap-2">
        <div className="grid size-8 place-items-center rounded-lg bg-brand-gradient text-white">
          <Sparkles className="size-4" />
        </div>
        <p className="text-sm font-semibold">Pro insights</p>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Unlock advanced forecasting models and unlimited AI chat.
      </p>
      <button className="mt-3 w-full rounded-lg bg-foreground py-2 text-xs font-semibold text-background transition hover:opacity-90">
        Upgrade plan
      </button>
    </div>
  );
}
