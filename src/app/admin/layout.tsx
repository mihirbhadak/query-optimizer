import { requireAdmin } from "@/lib/auth/dal";
import { logRetentionService } from "@/lib/logs";
import { workspaceService } from "@/lib/workspaces";
import { AppSidebar } from "@/components/admin/app-sidebar";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Admin-only: requireAdmin redirects guests to /login and non-admins to /.
  const user = await requireAdmin();
  // Opportunistic, throttled auto-cleanup of expired logs (no external scheduler).
  logRetentionService.maybePrune();
  const workspaces = workspaceService.list().map((w) => ({ id: w.id, slug: w.slug, name: w.name }));

  return (
    <SidebarProvider>
      <AppSidebar user={user} workspaces={workspaces} />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <span className="text-sm font-medium text-muted-foreground">Administration</span>
        </header>
        <div className="flex-1 overflow-auto">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
