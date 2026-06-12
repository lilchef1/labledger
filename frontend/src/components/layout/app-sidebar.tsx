"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  Settings2,
  Settings,
  PenTool,
  Building2,
  KeyRound,
  FlaskConical,
  Columns3,
  Tag,
  Hash,
  Blocks,
  Calculator,
  Zap,
  FileCode,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarHeader,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";

const navItems = [
  { title: "Dashboard", href: "/", icon: LayoutDashboard },
  { title: "Reports", href: "/reports", icon: FileText },
  { title: "Config", href: "/config", icon: Settings2 },
  { title: "Settings", href: "/settings", icon: Settings },
  { title: "Designer", href: "/designer", icon: PenTool, badge: "Soon" },
];

const CONFIG_SECTIONS = [
  { slug: "", label: "Lab Info", icon: Building2 },
  { slug: "field-keys", label: "Field Keys", icon: KeyRound },
  { slug: "analytes", label: "Analytes", icon: FlaskConical },
  { slug: "columns", label: "Columns", icon: Columns3 },
  { slug: "request-codes", label: "Request Codes", icon: Tag },
  { slug: "sig-figs", label: "Sig Figs", icon: Hash },
  { slug: "custom-blocks", label: "Custom Blocks", icon: Blocks },
  { slug: "computations", label: "Computed Fields", icon: Calculator },
  { slug: "triggers", label: "Triggers", icon: Zap },
  { slug: "template", label: "Templates", icon: FileCode },
];

function ConfigSubNav() {
  const pathname = usePathname();

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Config</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {CONFIG_SECTIONS.map((section) => {
            const href =
              section.slug === ""
                ? "/config"
                : `/config/${section.slug}`;
            const isActive =
              section.slug === ""
                ? pathname === "/config"
                : pathname === href || pathname.startsWith(`${href}/`);
            const Icon = section.icon;

            return (
              <SidebarMenuItem key={section.slug || "lab-info"}>
                <SidebarMenuButton
                  isActive={isActive}
                  render={<Link href={href} />}
                >
                  <Icon className="h-4 w-4" />
                  <span>{section.label}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

export function AppSidebar() {
  const pathname = usePathname();
  const isConfigRoute = pathname.startsWith("/config");

  return (
    <Sidebar>
      <SidebarHeader className="px-4 py-4">
        <span className="text-lg font-semibold">LabLedger</span>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href);

                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton isActive={isActive} render={<Link href={item.href} />}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                      {item.badge && (
                        <Badge variant="secondary" className="ml-auto text-xs">
                          {item.badge}
                        </Badge>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isConfigRoute && (
          <>
            <SidebarSeparator />
            <ConfigSubNav />
          </>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
