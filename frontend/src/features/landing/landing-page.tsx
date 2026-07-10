import { motion } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  Bot,
  Database,
  FileText,
  Shield,
  Sparkles,
  TrendingUp,
  Zap,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const FEATURES = [
  {
    icon: Database,
    title: "Any data source",
    desc: "CSV, Excel, PDF, or SQL. Drag, drop, and we handle the rest — parsing, profiling, and quality checks.",
  },
  {
    icon: Bot,
    title: "Chat with your data",
    desc: "Ask questions in plain English. Get answers, tables, and charts powered by Gemini.",
  },
  {
    icon: TrendingUp,
    title: "Forecasting that ships",
    desc: "Predict revenue and demand with ML models — scikit-learn and Prophet, no code required.",
  },
  {
    icon: BarChart3,
    title: "Interactive analytics",
    desc: "Zoom, hover, and export beautiful Plotly charts. Every insight is one click away.",
  },
  {
    icon: FileText,
    title: "Board-ready reports",
    desc: "Turn a dataset into a shareable executive summary in seconds.",
  },
  {
    icon: Shield,
    title: "Enterprise security",
    desc: "JWT auth, role-based access, audit logs, and rate limiting built in from day one.",
  },
];

const STATS = [
  { value: "10M+", label: "Rows processed" },
  { value: "<2s", label: "Avg. query time" },
  { value: "99.9%", label: "Uptime SLA" },
  { value: "4.9/5", label: "Customer rating" },
];

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.08, duration: 0.5 } }),
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Logo />
          <nav className="hidden items-center gap-8 text-sm font-medium text-muted-foreground md:flex">
            <a href="#features" className="transition hover:text-foreground">
              Features
            </a>
            <a href="#stats" className="transition hover:text-foreground">
              Why InsightIQ
            </a>
            <Link to="/login" className="transition hover:text-foreground">
              Sign in
            </Link>
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button asChild size="sm" variant="gradient" className="hidden sm:inline-flex">
              <Link to="/signup">Get started</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-mesh opacity-70" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
        <div className="relative mx-auto max-w-6xl px-4 pb-20 pt-20 text-center sm:px-6 sm:pt-28">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Badge variant="outline" className="mb-6 gap-1.5 border-border bg-card/60 py-1 backdrop-blur">
              <Sparkles className="size-3.5 text-primary" />
              Introducing AI-native decision intelligence
            </Badge>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05, duration: 0.6 }}
            className="mx-auto max-w-4xl text-balance text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl"
          >
            Turn raw data into <span className="text-gradient">decisions</span>, not spreadsheets.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12, duration: 0.6 }}
            className="mx-auto mt-6 max-w-2xl text-pretty text-lg text-muted-foreground"
          >
            Upload any dataset and instantly get quality reports, forecasts, interactive charts, and an AI
            analyst that answers your questions in plain English.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row"
          >
            <Button asChild size="lg" variant="gradient" className="w-full sm:w-auto">
              <Link to="/signup">
                Start for free <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
              <Link to="/login">Live demo</Link>
            </Button>
          </motion.div>
          <p className="mt-4 text-xs text-muted-foreground">No credit card required · Free forever tier</p>

          {/* Hero preview */}
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.3, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="mx-auto mt-16 max-w-5xl"
          >
            <div className="glass-strong overflow-hidden rounded-3xl border shadow-soft-lg">
              <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
                <span className="size-3 rounded-full bg-destructive/70" />
                <span className="size-3 rounded-full bg-warning/70" />
                <span className="size-3 rounded-full bg-success/70" />
                <div className="ml-3 h-6 flex-1 rounded-md bg-muted/60" />
              </div>
              <div className="grid gap-4 p-5 sm:grid-cols-3">
                {STATS.slice(0, 3).map((s, i) => (
                  <div key={i} className="rounded-2xl border border-border bg-card p-4 text-left">
                    <p className="text-2xl font-bold">{s.value}</p>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                  </div>
                ))}
                <div className="col-span-full flex h-40 items-end gap-2 rounded-2xl border border-border bg-card p-4">
                  {[35, 50, 42, 65, 58, 78, 70, 88, 82, 96, 90, 100].map((h, i) => (
                    <motion.div
                      key={i}
                      initial={{ height: 0 }}
                      animate={{ height: `${h}%` }}
                      transition={{ delay: 0.6 + i * 0.04, duration: 0.5 }}
                      className="flex-1 rounded-t-md bg-brand-gradient"
                    />
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats */}
      <section id="stats" className="border-y border-border bg-card/40">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-8 px-6 py-12 md:grid-cols-4">
          {STATS.map((s, i) => (
            <motion.div
              key={s.label}
              custom={i}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              variants={fadeUp}
              className="text-center"
            >
              <p className="text-3xl font-bold text-gradient sm:text-4xl">{s.value}</p>
              <p className="mt-1 text-sm text-muted-foreground">{s.label}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <Badge variant="outline" className="mb-4">
            <Zap className="size-3.5 text-primary" /> Everything you need
          </Badge>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            One platform, from upload to insight
          </h2>
          <p className="mt-4 text-muted-foreground">
            Stop stitching together five tools. InsightIQ handles ingestion, analysis, forecasting, and
            reporting — beautifully.
          </p>
        </div>

        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              custom={i}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-40px" }}
              variants={fadeUp}
              className="group relative overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-soft transition-all hover:-translate-y-1 hover:shadow-soft-lg"
            >
              <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent opacity-0 transition group-hover:opacity-100" />
              <div className="mb-4 grid size-11 place-items-center rounded-xl bg-brand-gradient-soft text-primary">
                <f.icon className="size-5" />
              </div>
              <h3 className="text-base font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl border border-border bg-mesh px-6 py-16 text-center sm:py-20">
          <div className="absolute inset-0 bg-grid bg-[size:28px_28px] opacity-30" />
          <div className="relative">
            <h2 className="mx-auto max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">
              Ready to make smarter decisions?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
              Join teams who replaced hours of spreadsheet wrangling with instant, AI-powered insight.
            </p>
            <Button asChild size="lg" variant="gradient" className="mt-8">
              <Link to="/signup">
                Get started free <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 text-sm text-muted-foreground sm:flex-row">
          <Logo />
          <p>© {new Date().getFullYear()} InsightIQ. Crafted with care.</p>
          <div className="flex gap-6">
            <a href="#" className="transition hover:text-foreground">
              Privacy
            </a>
            <a href="#" className="transition hover:text-foreground">
              Terms
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
