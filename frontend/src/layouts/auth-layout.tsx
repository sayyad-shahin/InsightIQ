import { motion } from "framer-motion";
import { Quote, Sparkles, TrendingUp } from "lucide-react";
import { Link, Outlet } from "react-router-dom";
import { Logo } from "@/components/brand/logo";

export function AuthLayout() {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Left: form */}
      <div className="flex flex-col px-6 py-8 sm:px-10">
        <Link to="/" className="w-fit">
          <Logo />
        </Link>
        <div className="flex flex-1 items-center justify-center py-10">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="w-full max-w-sm"
          >
            <Outlet />
          </motion.div>
        </div>
      </div>

      {/* Right: brand panel */}
      <div className="relative hidden overflow-hidden bg-mesh lg:block">
        <div className="absolute inset-0 bg-grid bg-[size:32px_32px] opacity-40" />
        <div className="relative flex h-full flex-col justify-between p-12">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Sparkles className="size-4 text-primary" />
            AI Decision Intelligence Platform
          </div>

          <div className="space-y-8">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, duration: 0.6 }}
              className="glass-strong rounded-3xl p-6 shadow-soft-lg"
            >
              <div className="mb-4 flex items-center gap-3">
                <div className="grid size-10 place-items-center rounded-xl bg-brand-gradient text-white">
                  <TrendingUp className="size-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Revenue forecast</p>
                  <p className="text-xs text-muted-foreground">Next 30 days · +18.2%</p>
                </div>
              </div>
              <div className="flex h-24 items-end gap-1.5">
                {[40, 55, 45, 70, 60, 85, 75, 95, 88, 100].map((h, i) => (
                  <motion.div
                    key={i}
                    initial={{ height: 0 }}
                    animate={{ height: `${h}%` }}
                    transition={{ delay: 0.4 + i * 0.05, duration: 0.5, ease: "easeOut" }}
                    className="flex-1 rounded-t-md bg-brand-gradient"
                  />
                ))}
              </div>
            </motion.div>

            <div className="max-w-md">
              <Quote className="mb-3 size-6 text-primary/60" />
              <p className="text-xl font-medium leading-relaxed">
                InsightIQ turned our messy spreadsheets into board-ready forecasts in minutes. It feels
                like magic.
              </p>
              <p className="mt-4 text-sm text-muted-foreground">Head of Analytics, Fortune 500 retailer</p>
            </div>
          </div>

          <div className="flex items-center gap-6 text-xs text-muted-foreground">
            <span>SOC 2 Type II</span>
            <span>GDPR ready</span>
            <span>99.9% uptime</span>
          </div>
        </div>
      </div>
    </div>
  );
}
