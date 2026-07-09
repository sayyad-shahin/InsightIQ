import { formatDistanceToNow } from "date-fns";
import { Activity, Bot, ChevronLeft, ChevronRight, Database, FileText, Server, TrendingUp, Users } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdminStats, useAuditLogs, useUpdateRole, useUsers } from "@/features/admin/hooks";
import { initials } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import type { UserRole } from "@/types/api";

const AUDIT_PAGE = 15;

export default function AdminPage() {
  const stats = useAdminStats();
  const users = useUsers();
  const updateRole = useUpdateRole();
  const [auditPage, setAuditPage] = useState(0);
  const audit = useAuditLogs(AUDIT_PAGE, auditPage * AUDIT_PAGE);

  const totals = stats.data?.totals;

  return (
    <div className="space-y-6">
      <PageHeader title="Admin" description="Platform monitoring, users, and audit trail." />

      {/* Overview */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Users" value={totals?.users} icon={Users} loading={stats.isLoading} />
        <Stat label="Datasets" value={totals?.datasets} icon={Database} loading={stats.isLoading} />
        <Stat label="Forecasts" value={totals?.forecasts} icon={TrendingUp} loading={stats.isLoading} />
        <Stat label="Reports" value={totals?.reports} icon={FileText} loading={stats.isLoading} />
        <Stat label="Chats" value={totals?.chats} icon={Bot} loading={stats.isLoading} />
      </div>

      {/* System health */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">System health</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Health label="Database" ok={!!stats.data?.services.database} />
          <Health label="Redis / broker" ok={!!stats.data?.services.redis_configured} detail={stats.data?.services.celery_eager ? "eager mode" : undefined} />
          <Health label="AI provider" ok={!!stats.data?.services.ai_configured} detail={stats.data?.services.ai_configured ? undefined : "not configured"} />
          <Health label="Environment" ok neutral detail={stats.data?.services.environment} />
        </div>
        {stats.data && (
          <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5"><Server className="size-4" /> {stats.data.datasets.processing} processing</span>
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5">{stats.data.datasets.errored} errored datasets</span>
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5">{stats.data.users.new_this_week} new users / 7d</span>
          </div>
        )}
      </section>

      {/* User management */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">User management</h2>
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3 font-medium">User</th>
                  <th className="hidden px-4 py-3 font-medium sm:table-cell">Status</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                </tr>
              </thead>
              <tbody>
                {users.isLoading ? (
                  <tr>
                    <td colSpan={3} className="p-4">
                      <Skeleton className="h-10 w-full" />
                    </td>
                  </tr>
                ) : (
                  (users.data ?? []).map((u) => (
                    <tr key={u.id} className="border-b border-border/60 last:border-0">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="size-8">
                            <AvatarFallback className="text-[11px]">{initials(u.full_name)}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="truncate font-medium">{u.full_name}</p>
                            <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="hidden px-4 py-3 sm:table-cell">
                        {u.is_active ? <Badge variant="success">Active</Badge> : <Badge variant="destructive">Disabled</Badge>}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={u.role}
                          onChange={(e) => updateRole.mutate({ userId: u.id, role: e.target.value as UserRole })}
                          className="h-8 rounded-lg border border-input bg-background px-2 text-sm capitalize outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {(["admin", "analyst", "viewer"] as const).map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Audit log */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Activity className="size-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Audit log</h2>
        </div>
        <div className="rounded-2xl border border-border bg-card p-2 shadow-soft">
          {audit.isLoading ? (
            <div className="space-y-2 p-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 rounded-lg" />
              ))}
            </div>
          ) : (audit.data ?? []).length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No audit entries.</p>
          ) : (
            <div className="divide-y divide-border/60">
              {(audit.data ?? []).map((log) => (
                <div key={log.id} className="flex items-center gap-3 px-3 py-2.5">
                  <code className="rounded-md bg-muted px-1.5 py-0.5 text-xs">{log.action}</code>
                  <span className="flex-1 truncate text-xs text-muted-foreground">
                    {log.ip_address ?? "—"} {log.user_id ? `· user ${log.user_id.slice(0, 8)}` : ""}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">{formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" size="icon-sm" onClick={() => setAuditPage((p) => Math.max(0, p - 1))} disabled={auditPage === 0} aria-label="Previous">
            <ChevronLeft className="size-4" />
          </Button>
          <span className="text-sm text-muted-foreground">Page {auditPage + 1}</span>
          <Button variant="outline" size="icon-sm" onClick={() => setAuditPage((p) => p + 1)} disabled={(audit.data ?? []).length < AUDIT_PAGE} aria-label="Next">
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, icon: Icon, loading }: { label: string; value?: number; icon: LucideIcon; loading: boolean }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
      <Icon className="mb-2 size-5 text-primary" />
      {loading ? <Skeleton className="h-7 w-12" /> : <p className="text-2xl font-bold tabular-nums">{value ?? 0}</p>}
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function Health({ label, ok, neutral, detail }: { label: string; ok: boolean; neutral?: boolean; detail?: string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-border bg-card p-4 shadow-soft">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {detail && <p className="text-xs capitalize text-muted-foreground">{detail}</p>}
      </div>
      <span className={`size-2.5 rounded-full ${neutral ? "bg-primary" : ok ? "bg-success" : "bg-destructive"}`} />
    </div>
  );
}
