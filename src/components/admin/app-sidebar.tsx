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
  ScrollText,
  ServerCog,
  Settings,
  Shield,
  Users,
  type LucideIcon,
} from "lucide-react";

import { logoutAction } from "@/lib/auth/actions";
import type { SafeUser } from "@/lib/users";
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
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from "@/components/ui/sidebar";

interface NavNode {
  title: string;
  href?: string;
  icon?: LucideIcon;
  defaultOpen?: boolean;
  children?: NavNode[];
}

// Nested items without a real route yet (#) get wired up with the workspace flow.
const NAV: NavNode[] = [
  { title: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
  {
    title: "Workspaces",
    href: "/admin/workspaces",
    icon: Building2,
    defaultOpen: true,
    children: [
      { title: "Instructions", href: "#" },
      { title: "Query Rules", href: "#" },
      {
        title: "Databases",
        href: "#",
        defaultOpen: true,
        children: [
          { title: "Instructions", href: "#" },
          { title: "Metadata", href: "#" },
          { title: "Query Rules", href: "#" },
          {
            title: "Tables",
            href: "#",
            defaultOpen: true,
            children: [
              { title: "Instructions", href: "#" },
              { title: "Columns", href: "#" },
              { title: "Indexes", href: "#" },
              { title: "Triggers", href: "#" },
              { title: "Procedures", href: "#" },
              { title: "Functions", href: "#" },
              { title: "Events", href: "#" },
            ],
          },
        ],
      },
    ],
  },
  { title: "Users", href: "/admin/users", icon: Users },
  { title: "Roles", href: "/admin/roles", icon: Shield },
  { title: "Agents", href: "/admin/agents", icon: Bot },
  { title: "Chat", href: "/admin/chat", icon: MessageSquare },
  { title: "Suggestions", href: "/admin/suggestions", icon: Lightbulb },
  { title: "User Logs", href: "/admin/user-logs", icon: ScrollText },
  { title: "System Logs", href: "/admin/system-logs", icon: ServerCog },
  { title: "Settings", href: "/admin/settings", icon: Settings },
];

function useIsActive() {
  const pathname = usePathname();
  return (href?: string) =>
    !!href && href !== "#" && (pathname === href || pathname.startsWith(`${href}/`));
}

function NavTree({ items, depth }: { items: NavNode[]; depth: number }) {
  const isActive = useIsActive();
  return (
    <>
      {items.map((item) => {
        const hasChildren = !!item.children?.length;
        const Item = depth === 0 ? SidebarMenuItem : SidebarMenuSubItem;
        const Button = depth === 0 ? SidebarMenuButton : SidebarMenuSubButton;

        if (!hasChildren) {
          return (
            <Item key={`${depth}-${item.title}`}>
              <Button asChild isActive={isActive(item.href)}>
                <Link href={item.href ?? "#"}>
                  {depth === 0 && item.icon ? <item.icon /> : null}
                  <span>{item.title}</span>
                </Link>
              </Button>
            </Item>
          );
        }

        return (
          <Collapsible
            key={`${depth}-${item.title}`}
            asChild
            defaultOpen={item.defaultOpen}
            className="group/collapsible"
          >
            <Item>
              <CollapsibleTrigger asChild>
                <Button>
                  {depth === 0 && item.icon ? <item.icon /> : null}
                  <span>{item.title}</span>
                  <ChevronRight className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarMenuSub>
                  <NavTree items={item.children!} depth={depth + 1} />
                </SidebarMenuSub>
              </CollapsibleContent>
            </Item>
          </Collapsible>
        );
      })}
    </>
  );
}

function initials(user: SafeUser): string {
  const fromName = `${user.first_name ?? ""}${user.last_name ?? ""}`.trim();
  const source = fromName || user.username;
  return source.slice(0, 2).toUpperCase();
}

export function AppSidebar({ user }: { user: SafeUser }) {
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
            <NavTree items={NAV} depth={0} />
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
