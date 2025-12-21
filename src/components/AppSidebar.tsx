// /src/components/AppSidebar.tsx

import {
  LayoutDashboard,
  TrendingUp,
  Sparkles,
  Wallet,
  BarChart3,
  Settings,
  LogOut,
  User,
} from "lucide-react";
import { NavLink } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { useProfileSummary } from "@/hooks/useProfileSummary";

const menuItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Markets", url: "/markets", icon: TrendingUp },
  { title: "AI Strategies", url: "/strategies", icon: Sparkles },
  { title: "Portfolio", url: "/portfolio", icon: Wallet },
  { title: "Analytics", url: "/analytics", icon: BarChart3 },
];

const bottomItems = [
  { title: "Settings", url: "/settings", icon: Settings },
  { title: "Logout", url: "/logout", icon: LogOut },
];

export function AppSidebar() {
  const { full_name, email } = useProfileSummary();

  return (
    <Sidebar className="border-r border-border w-44">
      {/* ================= BRAND HEADER ================= */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h2 className="font-bold text-lg">AlphaForge</h2>
            <p className="text-xs text-muted-foreground">Pro Trader</p>
          </div>
        </div>
      </div>

      {/* ================= MAIN CONTENT ================= */}
      <SidebarContent>
        {/* -------- Main Menu -------- */}
        <SidebarGroup>
          <SidebarGroupLabel>Main Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end
                      className={({ isActive }) =>
                        isActive
                          ? "bg-sidebar-accent text-sidebar-primary"
                          : "hover:bg-sidebar-accent/50"
                      }
                    >
                      <item.icon className="w-4 h-4" />
