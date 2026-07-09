import { motion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  delta?: number;
  spark?: number[];
  index?: number;
}

export function KpiCard({ label, value, icon: Icon, delta, spark, index = 0 }: KpiCardProps) {
  const positive = (delta ?? 0) >= 0;
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.4 }}
      className="group relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-soft transition-all hover:shadow-soft-lg"
    >
      <div className="pointer-events-none absolute -right-6 -top-6 size-24 rounded-full bg-brand-gradient-soft opacity-0 blur-2xl transition group-hover:opacity-100" />
      <div className="flex items-start justify-between">
        <div className="grid size-10 place-items-center rounded-xl bg-brand-gradient-soft text-primary">
          <Icon className="size-5" />
        </div>
        {delta !== undefined && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold",
              positive ? "bg-success/12 text-success" : "bg-destructive/12 text-destructive",
            )}
          >
            {positive ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
            {Math.abs(delta)}%
          </span>
        )}
      </div>
      <p className="mt-4 text-3xl font-bold tracking-tight">{value}</p>
      <p className="mt-1 text-sm text-muted-foreground">{label}</p>

      {spark && spark.length > 1 && (
        <div className="mt-3 flex h-8 items-end gap-1">
          {spark.map((h, i) => (
            <div
              key={i}
              className="flex-1 rounded-sm bg-primary/25 transition-colors group-hover:bg-primary/40"
              style={{ height: `${Math.max(12, h)}%` }}
            />
          ))}
        </div>
      )}
    </motion.div>
  );
}
