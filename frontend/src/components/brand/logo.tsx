import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <div
      className={cn("grid place-items-center rounded-xl bg-brand-gradient text-white shadow-glow", className)}
    >
      <svg viewBox="0 0 32 32" className="size-[62%]" fill="none">
        <path d="M9 21V15M16 21V11M23 21V17" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
      </svg>
    </div>
  );
}

export function Logo({ className, collapsed }: { className?: string; collapsed?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <LogoMark className="size-9" />
      {!collapsed && (
        <span className="text-lg font-bold tracking-tight">
          Insight<span className="text-gradient">IQ</span>
        </span>
      )}
    </div>
  );
}
