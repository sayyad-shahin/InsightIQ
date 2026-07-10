import { cn } from "@/lib/utils";

/** Circular data-quality score gauge (0–100). */
export function QualityRing({ score, size = 96 }: { score: number; size?: number }) {
  const radius = (size - 10) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - score / 100);
  const tone = score >= 80 ? "text-success" : score >= 55 ? "text-warning" : "text-destructive";

  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} strokeWidth={7} className="fill-none stroke-muted" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={7}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={cn("fill-none transition-all duration-700 ease-out", tone)}
          stroke="currentColor"
        />
      </svg>
      <div className="absolute text-center">
        <p className={cn("text-2xl font-bold tabular-nums", tone)}>{score}</p>
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Quality</p>
      </div>
    </div>
  );
}
