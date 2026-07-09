import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { motion } from "framer-motion";
import { Bot, Camera, Database, FileText, Loader2, Mail, ShieldCheck, TrendingUp } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useSettings, useUpdateSettings } from "@/features/settings/hooks";
import { api } from "@/lib/api";
import { useAuth } from "@/providers/auth-provider";
import { formatNumber, initials } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

async function downscaleImage(file: File, size = 160): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const scale = Math.max(size / bitmap.width, size / bitmap.height);
  const w = bitmap.width * scale;
  const h = bitmap.height * scale;
  ctx.drawImage(bitmap, (size - w) / 2, (size - h) / 2, w, h);
  return canvas.toDataURL("image/jpeg", 0.85);
}

export default function ProfilePage() {
  const { user } = useAuth();
  const settingsQ = useSettings();
  const update = useUpdateSettings();
  const prefs = (settingsQ.data?.preferences ?? {}) as Record<string, any>;
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const datasets = useQuery({ queryKey: ["datasets"], queryFn: api.datasets.list });
  const chats = useQuery({ queryKey: ["chats"], queryFn: api.chats.list });
  const forecasts = useQuery({ queryKey: ["forecasts", "all"], queryFn: () => api.forecasts.list() });
  const reports = useQuery({ queryKey: ["reports"], queryFn: api.reports.list });

  async function onAvatar(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("Please choose an image");
    setUploading(true);
    try {
      const dataUrl = await downscaleImage(file);
      await update.mutateAsync({ preferences: { ...prefs, avatar: dataUrl } });
      toast.success("Avatar updated");
    } catch {
      toast.error("Could not process image");
    } finally {
      setUploading(false);
    }
  }

  const activity = buildActivity(datasets.data ?? [], forecasts.data ?? [], reports.data ?? [], chats.data ?? []);

  return (
    <div className="space-y-6">
      <PageHeader title="Profile" description="Your account and activity overview." />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Identity */}
        <div className="rounded-2xl border border-border bg-card p-6 text-center shadow-soft">
          <div className="relative mx-auto w-fit">
            <Avatar className="size-24 ring-4 ring-background">
              {prefs.avatar && <AvatarImage src={prefs.avatar} alt="Avatar" />}
              <AvatarFallback className="text-2xl">{initials(user?.full_name ?? "U")}</AvatarFallback>
            </Avatar>
            <button
              onClick={() => fileRef.current?.click()}
              className="absolute -bottom-1 -right-1 grid size-9 place-items-center rounded-full border-2 border-background bg-brand-gradient text-white shadow-soft transition hover:shadow-glow"
              aria-label="Upload avatar"
            >
              {uploading ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onAvatar(e.target.files?.[0])} />
          </div>
          <h2 className="mt-4 text-lg font-semibold">{user?.full_name}</h2>
          <p className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
            <Mail className="size-3.5" /> {user?.email}
          </p>
          <div className="mt-3 flex items-center justify-center gap-2">
            <Badge variant="secondary" className="capitalize">
              {user?.role}
            </Badge>
            {user?.is_email_verified ? (
              <Badge variant="success">
                <ShieldCheck className="size-3" /> Verified
              </Badge>
            ) : (
              <Badge variant="warning">Unverified</Badge>
            )}
          </div>
          {user && (
            <p className="mt-4 text-xs text-muted-foreground">
              Member since {new Date(user.created_at).toLocaleDateString()}
            </p>
          )}
        </div>

        {/* Stats + activity */}
        <div className="space-y-6 lg:col-span-2">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard label="Datasets" value={datasets.data?.length} loading={datasets.isLoading} icon={Database} />
            <StatCard label="Chats" value={chats.data?.length} loading={chats.isLoading} icon={Bot} />
            <StatCard label="Forecasts" value={forecasts.data?.length} loading={forecasts.isLoading} icon={TrendingUp} />
            <StatCard label="Reports" value={reports.data?.length} loading={reports.isLoading} icon={FileText} />
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
            <h3 className="mb-4 text-sm font-semibold">Activity timeline</h3>
            {activity.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No activity yet.</p>
            ) : (
              <div className="space-y-1">
                {activity.map((item, i) => (
                  <div key={item.id} className="relative flex gap-3 pb-4 last:pb-0">
                    {i < activity.length - 1 && <div className="absolute left-[15px] top-8 h-full w-px bg-border" />}
                    <div className="grid size-8 shrink-0 place-items-center rounded-full border border-border bg-card">
                      <item.icon className={`size-4 ${item.tone}`} />
                    </div>
                    <div className="min-w-0 flex-1 pt-1">
                      <p className="truncate text-sm">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(item.time), { addSuffix: true })}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, loading, icon: Icon }: { label: string; value?: number; loading: boolean; icon: LucideIcon }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-border bg-card p-4 shadow-soft">
      <Icon className="mb-2 size-5 text-primary" />
      {loading ? <Skeleton className="h-7 w-12" /> : <p className="text-2xl font-bold tabular-nums">{formatNumber(value ?? 0)}</p>}
      <p className="text-xs text-muted-foreground">{label}</p>
    </motion.div>
  );
}

interface ActivityItem {
  id: string;
  label: string;
  time: string;
  icon: LucideIcon;
  tone: string;
}

function buildActivity(
  datasets: { id: string; name: string; created_at: string }[],
  forecasts: { id: string; target_column: string; created_at: string }[],
  reports: { id: string; title: string; created_at: string }[],
  chats: { id: string; title: string; created_at: string }[],
): ActivityItem[] {
  return [
    ...datasets.map((d) => ({ id: `d-${d.id}`, label: `Uploaded ${d.name}`, time: d.created_at, icon: Database, tone: "text-primary" })),
    ...forecasts.map((f) => ({ id: `f-${f.id}`, label: `Forecast on ${f.target_column}`, time: f.created_at, icon: TrendingUp, tone: "text-success" })),
    ...reports.map((r) => ({ id: `r-${r.id}`, label: `Report: ${r.title}`, time: r.created_at, icon: FileText, tone: "text-warning" })),
    ...chats.map((c) => ({ id: `c-${c.id}`, label: `Chat: ${c.title}`, time: c.created_at, icon: Bot, tone: "text-brand-400" })),
  ]
    .sort((a, b) => +new Date(b.time) - +new Date(a.time))
    .slice(0, 8);
}
