"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  FileStack,
  ShieldAlert,
  Share2,
  BarChart3,
  Users,
  Boxes,
  ShieldCheck,
  ClipboardCheck,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { WorkspaceSwitcher } from "@/components/workspace-switcher";
import { LogoutButton } from "@/components/logout-button";
import type { Role } from "@/lib/auth/rbac";

/**
 * Mirrors the nav structure DESIGN-SYSTEM.md's "Overview · Vendors · Assessments · Risk ·
 * Governance" grouping (UI-REVAMP-PLAN.md Phase 2). `capability` is checked against the
 * caller's role so a `viewer`/`business_owner` never sees a link to a route
 * `requireCurrentMembershipWithCapability()` would 403 them out of anyway.
 */
const NAV_GROUPS: Array<{
  label: string;
  items: Array<{
    href: string;
    label: string;
    icon: typeof LayoutDashboard;
    capability?: string;
  }>;
}> = [
  {
    label: "Overview",
    items: [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Vendors",
    items: [{ href: "/vendors", label: "Vendors", icon: Building2 }],
  },
  {
    label: "Assessments",
    items: [
      { href: "/assessments", label: "Review queue", icon: ClipboardCheck },
      { href: "/templates", label: "Templates", icon: FileStack },
    ],
  },
  {
    label: "Risk",
    items: [{ href: "/risks", label: "Risk Register", icon: ShieldAlert }],
  },
  {
    label: "Governance",
    items: [
      {
        href: "/sharing",
        label: "Sharing",
        icon: Share2,
        capability: "sharing.manage",
      },
      {
        href: "/rollup",
        label: "Executive Roll-up",
        icon: BarChart3,
        capability: "rollup.view",
      },
      {
        href: "/admin/users",
        label: "Users",
        icon: Users,
        capability: "workspace.manage_users",
      },
      {
        href: "/admin/workspaces",
        label: "Workspaces",
        icon: Boxes,
        capability: "super_admin",
      },
    ],
  },
];

export function AppSidebar({
  role,
  isSuperAdmin,
}: {
  role: Role;
  isSuperAdmin: boolean;
}) {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <ShieldCheck
            className="text-sidebar-primary size-5 shrink-0"
            aria-hidden="true"
          />
          <span className="text-sidebar-foreground truncate text-sm font-bold tracking-tight group-data-[collapsible=icon]:hidden">
            MV-VRA
          </span>
        </div>
        <div className="group-data-[collapsible=icon]:hidden">
          <WorkspaceSwitcher />
        </div>
      </SidebarHeader>
      <SidebarContent>
        {NAV_GROUPS.map((group) => {
          const visibleItems = group.items.filter(
            (item) =>
              !item.capability ||
              (item.capability === "super_admin"
                ? isSuperAdmin
                : roleCanSee(role, item.capability)),
          );
          if (visibleItems.length === 0) return null;
          return (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {visibleItems.map((item) => {
                    const isActive = pathname.startsWith(item.href);
                    return (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton
                          render={<Link href={item.href} />}
                          isActive={isActive}
                          tooltip={item.label}
                        >
                          <item.icon />
                          <span>{item.label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>
      <SidebarFooter>
        <div className="group-data-[collapsible=icon]:hidden">
          <LogoutButton />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

/**
 * Duplicates `roleHasCapability()`'s lookup logic (`lib/auth/rbac.ts`) rather than importing
 * it directly — that function's `Capability` union is narrower than the loose string type
 * used here to keep this nav config declarative. A visibility miss here is not a security
 * gap: the route's own `requireCurrentMembershipWithCapability()` call is still the real
 * enforcement (CONSTRAINTS.md #9-adjacent — never trust the UI layer for auth).
 */
function roleCanSee(role: Role, capability: string): boolean {
  const grants: Record<Role, string[]> = {
    admin: [
      "sharing.manage",
      "rollup.view",
      "workspace.manage_users",
      "vendor.write",
      "template.manage",
      "assessment.assign",
      "assessment.review",
      "offboarding.manage",
    ],
    risk_analyst: [
      "rollup.view",
      "vendor.write",
      "template.manage",
      "assessment.assign",
      "assessment.review",
      "offboarding.manage",
    ],
    business_owner: ["vendor.write", "assessment.assign"],
    viewer: [],
  };
  return grants[role]?.includes(capability) ?? false;
}
