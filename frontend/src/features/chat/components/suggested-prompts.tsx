import { motion } from "framer-motion";
import { AlertTriangle, BarChart3, LineChart, Sparkles, TrendingUp, Waypoints } from "lucide-react";

const PROMPTS = [
  {
    icon: Sparkles,
    label: "Summarize key business insights",
    prompt: "Summarize the key business insights and give executive recommendations.",
  },
  {
    icon: BarChart3,
    label: "Top performers by revenue",
    prompt: "Which categories generated the highest revenue?",
  },
  {
    icon: LineChart,
    label: "Show trends over time",
    prompt: "Show the sales trend over time and explain the movement.",
  },
  { icon: AlertTriangle, label: "Detect anomalies", prompt: "Find anomalies and outliers in this dataset." },
  {
    icon: TrendingUp,
    label: "Forecast next periods",
    prompt: "Predict the next quarter based on historical data.",
  },
  {
    icon: Waypoints,
    label: "Find correlations",
    prompt: "What are the strongest correlations between metrics?",
  },
];

export function SuggestedPrompts({ onSelect }: { onSelect: (prompt: string) => void }) {
  return (
    <div className="grid gap-2.5 sm:grid-cols-2">
      {PROMPTS.map((p, i) => (
        <motion.button
          key={p.label}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }}
          onClick={() => onSelect(p.prompt)}
          className="group flex items-center gap-3 rounded-xl border border-border bg-card p-3.5 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-soft"
        >
          <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-gradient-soft text-primary">
            <p.icon className="size-4" />
          </div>
          <span className="text-sm font-medium">{p.label}</span>
        </motion.button>
      ))}
    </div>
  );
}
