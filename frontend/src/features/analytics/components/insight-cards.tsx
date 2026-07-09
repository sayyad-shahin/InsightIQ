import { motion } from "framer-motion";
import { AlertTriangle, Gauge, Lightbulb, ListChecks, Rocket, TrendingUp, type LucideIcon } from "lucide-react";
import type { BusinessInsights } from "@/types/api";

const GROUPS: { key: keyof BusinessInsights; title: string; icon: LucideIcon; tone: string }[] = [
  { key: "key_insights", title: "Key insights", icon: Lightbulb, tone: "text-primary bg-primary/10" },
  { key: "revenue_drivers", title: "Revenue drivers", icon: Gauge, tone: "text-brand-400 bg-brand-400/10" },
  { key: "growth_trends", title: "Growth trends", icon: TrendingUp, tone: "text-success bg-success/12" },
  { key: "opportunities", title: "Opportunities", icon: Rocket, tone: "text-cyan-500 bg-cyan-500/12" },
  { key: "risks", title: "Risks", icon: AlertTriangle, tone: "text-destructive bg-destructive/12" },
  { key: "recommendations", title: "Recommendations", icon: ListChecks, tone: "text-warning bg-warning/12" },
];

function stripMd(s: string) {
  return s.replace(/\*\*(.*?)\*\*/g, "$1");
}

export function InsightCards({ insights }: { insights: BusinessInsights }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {GROUPS.map((g, i) => {
        const items = insights[g.key];
        if (!items?.length) return null;
        return (
          <motion.div
            key={g.key}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="rounded-2xl border border-border bg-card p-4 shadow-soft"
          >
            <div className="mb-3 flex items-center gap-2">
              <div className={`grid size-8 place-items-center rounded-lg ${g.tone}`}>
                <g.icon className="size-4" />
              </div>
              <p className="text-sm font-semibold">{g.title}</p>
            </div>
            <ul className="space-y-2">
              {items.map((item, idx) => (
                <li key={idx} className="flex gap-2 text-sm text-foreground/85">
                  <span className={`mt-1.5 size-1.5 shrink-0 rounded-full ${g.tone.split(" ")[0].replace("text", "bg")}`} />
                  <span>{stripMd(item)}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        );
      })}
    </div>
  );
}
