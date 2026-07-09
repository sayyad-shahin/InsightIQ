import { motion } from "framer-motion";
import { ArrowLeft, Home } from "lucide-react";
import { Link } from "react-router-dom";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

export default function NotFoundPage() {
  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden bg-background px-6">
      <div className="pointer-events-none absolute inset-0 bg-mesh opacity-60" />
      <div className="pointer-events-none absolute inset-0 bg-grid bg-[size:32px_32px] opacity-20" />
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative w-full max-w-md text-center"
      >
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <p className="bg-brand-gradient bg-clip-text text-8xl font-black tracking-tighter text-transparent">
          404
        </p>
        <h1 className="mt-4 text-2xl font-bold tracking-tight">Page not found</h1>
        <p className="mt-2 text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Button asChild variant="gradient">
            <Link to="/app">
              <Home className="size-4" /> Back to dashboard
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/">
              <ArrowLeft className="size-4" /> Go home
            </Link>
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
