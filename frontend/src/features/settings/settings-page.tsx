import { Bell, KeyRound, Monitor, Moon, Palette, Save, Shield, Sun, User as UserIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSettings, useUpdateSettings } from "@/features/settings/hooks";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/providers/auth-provider";
import { useTheme } from "@/providers/theme-provider";
import { cn } from "@/lib/utils";
import type { ThemePreference } from "@/types/api";

export default function SettingsPage() {
  const settingsQ = useSettings();
  const update = useUpdateSettings();
  const prefs = (settingsQ.data?.preferences ?? {}) as Record<string, any>;

  function savePrefs(patch: Record<string, unknown>) {
    update.mutate({ preferences: { ...prefs, ...patch } }, { onSuccess: () => toast.success("Saved") });
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Manage your profile, appearance, and account." />

      <Tabs defaultValue="profile">
        <TabsList className="flex-wrap">
          <TabsTrigger value="profile"><UserIcon className="size-4" /> Profile</TabsTrigger>
          <TabsTrigger value="appearance"><Palette className="size-4" /> Appearance</TabsTrigger>
          <TabsTrigger value="notifications"><Bell className="size-4" /> Notifications</TabsTrigger>
          <TabsTrigger value="security"><Shield className="size-4" /> Security</TabsTrigger>
          <TabsTrigger value="api"><KeyRound className="size-4" /> API keys</TabsTrigger>
        </TabsList>

        <TabsContent value="profile"><ProfileTab /></TabsContent>
        <TabsContent value="appearance"><AppearanceTab language={settingsQ.data?.language ?? "en"} onLanguage={(language) => update.mutate({ language }, { onSuccess: () => toast.success("Saved") })} /></TabsContent>
        <TabsContent value="notifications"><NotificationsTab prefs={prefs} onSave={savePrefs} /></TabsContent>
        <TabsContent value="security"><SecurityTab /></TabsContent>
        <TabsContent value="api"><ApiKeysTab prefs={prefs} onSave={savePrefs} saving={update.isPending} /></TabsContent>
      </Tabs>
    </div>
  );
}

function Card({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="max-w-2xl rounded-2xl border border-border bg-card p-6 shadow-soft">
      <h2 className="text-base font-semibold">{title}</h2>
      {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      <div className="mt-5 space-y-4">{children}</div>
    </div>
  );
}

function ProfileTab() {
  const { user, refreshUser } = useAuth();
  const [fullName, setFullName] = useState(user?.full_name ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await api.users.updateMe({ full_name: fullName.trim() });
      await refreshUser();
      toast.success("Profile updated");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Update failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card title="Profile" description="Update your personal information.">
      <div className="space-y-2">
        <Label htmlFor="fullname">Full name</Label>
        <Input id="fullname" value={fullName} onChange={(e) => setFullName(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" value={user?.email ?? ""} disabled />
        <p className="text-xs text-muted-foreground">Email cannot be changed.</p>
      </div>
      <Button onClick={save} loading={saving} disabled={!fullName.trim() || fullName === user?.full_name}>
        <Save className="size-4" /> Save changes
      </Button>
    </Card>
  );
}

function AppearanceTab({ language, onLanguage }: { language: string; onLanguage: (l: string) => void }) {
  const { theme, setTheme } = useTheme();
  const update = useUpdateSettings();
  const options: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
    { value: "system", label: "System", icon: Monitor },
  ];
  return (
    <Card title="Appearance" description="Customize how InsightIQ looks.">
      <div className="space-y-2">
        <Label>Theme</Label>
        <div className="grid grid-cols-3 gap-2">
          {options.map((o) => (
            <button
              key={o.value}
              onClick={() => { setTheme(o.value); update.mutate({ theme: o.value }); }}
              className={cn(
                "flex flex-col items-center gap-2 rounded-xl border p-3 text-sm transition",
                theme === o.value ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-accent",
              )}
            >
              <o.icon className="size-5" />
              {o.label}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="lang">Language</Label>
        <select id="lang" value={language} onChange={(e) => onLanguage(e.target.value)} className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {[["en", "English"], ["es", "Español"], ["fr", "Français"], ["de", "Deutsch"], ["hi", "हिन्दी"]].map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </div>
    </Card>
  );
}

function NotificationsTab({ prefs, onSave }: { prefs: Record<string, any>; onSave: (p: Record<string, unknown>) => void }) {
  const notif = prefs.notifications ?? { product_updates: true, weekly_digest: false, forecast_ready: true };
  function toggle(key: string, value: boolean) {
    onSave({ notifications: { ...notif, [key]: value } });
  }
  const rows = [
    { key: "product_updates", label: "Product updates", desc: "New features and improvements" },
    { key: "weekly_digest", label: "Weekly digest", desc: "A summary of your workspace activity" },
    { key: "forecast_ready", label: "Forecast ready", desc: "Notify when a forecast finishes" },
  ];
  return (
    <Card title="Notifications" description="Choose what you want to hear about.">
      {rows.map((r) => (
        <label key={r.key} className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">{r.label}</p>
            <p className="text-xs text-muted-foreground">{r.desc}</p>
          </div>
          <Switch checked={!!notif[r.key]} onCheckedChange={(v) => toggle(r.key, v)} />
        </label>
      ))}
    </Card>
  );
}

function SecurityTab() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.users.changePassword(current, next);
      toast.success("Password changed");
      setCurrent("");
      setNext("");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not change password");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card title="Change password" description="Use a strong, unique password.">
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="current">Current password</Label>
          <Input id="current" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="new">New password</Label>
          <Input id="new" type="password" value={next} onChange={(e) => setNext(e.target.value)} required minLength={8} />
        </div>
        <Button type="submit" loading={saving} disabled={!current || next.length < 8}>
          Update password
        </Button>
      </form>
    </Card>
  );
}

function ApiKeysTab({ prefs, onSave, saving }: { prefs: Record<string, any>; onSave: (p: Record<string, unknown>) => void; saving: boolean }) {
  // Secrets are never returned by the API — only a "set" flag per provider.
  const setFlags = (prefs.api_keys_set ?? {}) as Record<string, boolean>;
  const [gemini, setGemini] = useState("");
  const [openai, setOpenai] = useState("");

  function save() {
    const keys: Record<string, string> = {};
    if (gemini) keys.gemini = gemini;
    if (openai) keys.openai = openai;
    onSave({ api_keys: keys });
    setGemini("");
    setOpenai("");
  }

  return (
    <Card title="API keys" description="Encrypted at rest and never returned by the API.">
      <div className="space-y-2">
        <Label htmlFor="gemini">Google Gemini API key</Label>
        <Input
          id="gemini"
          type="password"
          value={gemini}
          onChange={(e) => setGemini(e.target.value)}
          placeholder={setFlags.gemini ? "•••••••••••• (saved — enter to replace)" : "AIza…"}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="openai">OpenAI API key</Label>
        <Input
          id="openai"
          type="password"
          value={openai}
          onChange={(e) => setOpenai(e.target.value)}
          placeholder={setFlags.openai ? "•••••••••••• (saved — enter to replace)" : "sk-…"}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Keys are encrypted with your account. The server uses its own configured key for generation.
      </p>
      <Button onClick={save} loading={saving} disabled={!gemini && !openai}>
        <Save className="size-4" /> Save keys
      </Button>
    </Card>
  );
}
