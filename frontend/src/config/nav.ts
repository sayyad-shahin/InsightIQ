import {
  BarChart3,
  Bot,
  Database,
  FileText,
  LayoutDashboard,
  Settings,
  Shield,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  adminOnly?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { title: "Dashboard", href: "/app", icon: LayoutDashboard },
  { title: "Datasets", href: "/app/datasets", icon: Database },
  { title: "Analytics", href: "/app/analytics", icon: BarChart3 },
  { title: "AI Chat", href: "/app/chat", icon: Bot },
  { title: "Forecasts", href: "/app/forecasts", icon: TrendingUp },
  { title: "Reports", href: "/app/reports", icon: FileText },
  { title: "Admin", href: "/app/admin", icon: Shield, adminOnly: true },
  { title: "Settings", href: "/app/settings", icon: Settings },
];
