import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Logo } from "@/components/brand/logo";
import { CommandPalette } from "@/components/shared/command-palette";
import { Sidebar, SidebarNav } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { TooltipProvider } from "@/components/ui/tooltip";

export function AppLayout() {
  const [mobileNav, setMobileNav] = useState(false);
  const location = useLocation();

  return (
    <TooltipProvider delayDuration={200}>
      <div className="min-h-screen bg-background">
        <Sidebar />

        {/* Mobile navigation drawer */}
        <Dialog open={mobileNav} onOpenChange={setMobileNav}>
          <DialogContent
            hideClose
            className="fixed left-0 top-0 h-full max-w-[280px] translate-x-0 translate-y-0 rounded-none rounded-r-2xl border-y-0 border-l-0 p-0 data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left"
          >
            <div className="flex h-16 items-center px-5">
              <Logo />
            </div>
            <SidebarNav onNavigate={() => setMobileNav(false)} />
          </DialogContent>
        </Dialog>

        <div className="lg:pl-64">
          <Topbar onOpenMobileNav={() => setMobileNav(true)} />
          <main className="mx-auto max-w-7xl px-4 py-6 lg:px-8 lg:py-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              >
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </main>
        </div>

        <CommandPalette />
      </div>
    </TooltipProvider>
  );
}
