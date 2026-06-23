"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bot,
  Building2,
  ChevronRight,
  ChevronsUpDown,
  Database,
  LayoutDashboard,
  Lightbulb,
  LogOut,
  MessageSquare,
  Plus,
  ScrollText,
  ServerCog,
  Settings,
  Shield,
  Users,
  type LucideIcon,
} from "lucide-react";

import { logoutAction } from "@/lib/auth/actions";
import type { SafeUser } from "@/lib/users";
import { CreateWorkspaceDialog } from "@/app/admin/workspaces/CreateWorkspaceDialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from "@/components/ui/sidebar";

export interface SidebarWorkspace {
  id: number;
  slug: string;
  name: string;
}

interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
}

const NAV: NavItem[] = [
  { title: "Users", href: "/admin/users", icon: Users },
  { title: "Roles", href: "/admin/roles", icon: Shield },
  { title: "Agents", href: "/admin/agents", icon: Bot },
  { title: "Chat", href: "/admin/chat", icon: MessageSquare },
  { title: "Suggestions", href: "/admin/suggestions", icon: Lightbulb },
  { title: "User Logs", href: "/admin/user-logs", icon: ScrollText },
  { title: "System Logs", href: "/admin/system-logs", icon: ServerCog },
  { title: "Settings", href: "/admin/settings", icon: Settings },
];

function initials(user: SafeUser): string {
  const fromName = `${user.first_name ?? ""}${user.last_name ?? ""}`.trim();
  return (fromName || user.username).slice(0, 2).toUpperCase();
}

export function AppSidebar({
  user,
  workspaces,
}: {
  user: SafeUser;
  workspaces: SidebarWorkspace[];
}) {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild size="lg">
              <Link href="/admin/dashboard">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Database className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">Query Optimizer</span>
                  <span className="truncate text-xs text-muted-foreground">Admin</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {/* Dashboard */}
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={pathname === "/admin/dashboard"}
                tooltip="Dashboard"
              >
                <Link href="/admin/dashboard">
                  <LayoutDashboard />
                  <span>Dashboard</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>

            {/* Workspaces: collapsible — label navigates, chevron toggles */}
            <Collapsible asChild defaultOpen className="group/collapsible">
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isActive("/admin/workspaces")}
                  tooltip="Workspaces"
                >
                  <Link href="/admin/workspaces">
                    <Building2 />
                    <span>Workspaces</span>
                  </Link>
                </SidebarMenuButton>
                <CollapsibleTrigger asChild>
                  <SidebarMenuAction className="transition-transform data-[state=open]:rotate-90">
                    <ChevronRight />
                    <span className="sr-only">Toggle workspaces</span>
                  </SidebarMenuAction>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenuSub>
                    {workspaces.map((ws) => (
                      <SidebarMenuSubItem key={ws.id}>
                        <SidebarMenuSubButton
                          asChild
                          isActive={isActive(`/admin/workspaces/${ws.slug}`)}
                        >
                          <Link href={`/admin/workspaces/${ws.slug}`}>
                            <span className="truncate">{ws.name}</span>
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    ))}
                    <SidebarMenuSubItem>
                      <CreateWorkspaceDialog
                        trigger={
                          <button
                            type="button"
                            className="flex h-7 w-full items-center gap-2 rounded-md px-2 text-sm text-sidebar-foreground/70 outline-none transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                          >
                            <Plus className="size-4" />
                            New workspace
                          </button>
                        }
                      />
                    </SidebarMenuSubItem>
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>

            {/* Remaining sections */}
            {NAV.map((item) => (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton asChild isActive={isActive(item.href)} tooltip={item.title}>
                  <Link href={item.href}>
                    <item.icon />
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent">
                  <Avatar className="size-8 rounded-lg">
                    <AvatarFallback className="rounded-lg">{initials(user)}</AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">{user.username}</span>
                    <span className="truncate text-xs text-muted-foreground">{user.email}</span>
                  </div>
                  <ChevronsUpDown className="ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="top"
                align="end"
                className="w-(--radix-dropdown-menu-trigger-width) min-w-56"
              >
                <DropdownMenuLabel className="font-normal">
                  <div className="grid text-sm">
                    <span className="truncate font-medium">{user.username}</span>
                    <span className="truncate text-xs text-muted-foreground">{user.email}</span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <Link
                  href="/"
                  className="relative flex w-full cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  <LayoutDashboard className="size-4" />
                  Back to app
                </Link>
                <DropdownMenuSeparator />
                <form action={logoutAction}>
                  <button
                    type="submit"
                    className="relative flex w-full cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-red-600 outline-none transition-colors hover:bg-accent dark:text-red-400"
                  >
                    <LogOut className="size-4" />
                    Log out
                  </button>
                </form>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
