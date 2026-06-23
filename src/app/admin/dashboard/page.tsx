import { requireAdmin } from "@/lib/auth/dal";
import { settingsService } from "@/lib/settings";
import { userService, userLogService } from "@/lib/users";
import { workspacesRepository } from "@/lib/db";
import { ActiveSyncs } from "@/components/admin/active-syncs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { approveUser, rejectUser, setSignupApproval } from "../actions";

export const metadata = { title: "Admin · Dashboard" };

function Stat({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-3xl tabular-nums">{value}</CardTitle>
      </CardHeader>
      {hint ? <CardContent className="text-xs text-muted-foreground">{hint}</CardContent> : null}
    </Card>
  );
}

export default async function AdminDashboardPage() {
  await requireAdmin();

  const totalUsers = userService.count();
  const admins = userService.countAdmins();
  const pending = userService.listPending();
  const workspaces = workspacesRepository.list().length;
  const requiresApproval = settingsService.signupRequiresApproval();
  const recentLogs = userLogService.recent(8);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Overview of your Query Optimizer instance.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Users" value={totalUsers} />
        <Stat label="Active admins" value={admins} />
        <Stat label="Pending approvals" value={pending.length} hint="Awaiting your review" />
        <Stat label="Workspaces" value={workspaces} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Signup requests + approval setting */}
        <Card>
          <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
            <div>
              <CardTitle className="text-base">Signup requests</CardTitle>
              <CardDescription>
                {requiresApproval
                  ? "New signups require approval before they can log in."
                  : "New signups are active immediately."}
              </CardDescription>
            </div>
            <form action={setSignupApproval}>
              <input type="hidden" name="enabled" value={(!requiresApproval).toString()} />
              <Button type="submit" size="sm" variant={requiresApproval ? "default" : "outline"}>
                {requiresApproval ? "Approval: On" : "Approval: Off"}
              </Button>
            </form>
          </CardHeader>
          <CardContent>
            {pending.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No pending requests.</p>
            ) : (
              <ul className="divide-y">
                {pending.map((u) => (
                  <li key={u.id} className="flex items-center justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{u.username}</div>
                      <div className="truncate text-xs text-muted-foreground">{u.email}</div>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <form action={approveUser}>
                        <input type="hidden" name="userId" value={u.id} />
                        <Button type="submit" size="sm">
                          Approve
                        </Button>
                      </form>
                      <form action={rejectUser}>
                        <input type="hidden" name="userId" value={u.id} />
                        <Button type="submit" size="sm" variant="outline">
                          Reject
                        </Button>
                      </form>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Recent activity */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent activity</CardTitle>
            <CardDescription>Latest entries from the user audit log.</CardDescription>
          </CardHeader>
          <CardContent>
            {recentLogs.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No activity yet.</p>
            ) : (
              <ul className="space-y-2">
                {recentLogs.map((log) => (
                  <li key={log.id} className="flex items-center justify-between gap-3 text-sm">
                    <Badge variant="secondary" className="font-mono text-[11px]">
                      {log.action}
                    </Badge>
                    <span className="shrink-0 text-xs text-muted-foreground">{log.created_at}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Live schema-sync activity */}
        <ActiveSyncs />
      </div>
    </div>
  );
}
