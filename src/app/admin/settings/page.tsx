import { Brush, Trash2 } from "lucide-react";

import { requireAdmin } from "@/lib/auth/dal";
import { logRetentionService } from "@/lib/logs";
import { settingsService } from "@/lib/settings";
import { ConfirmSubmit } from "@/components/admin/confirm-submit";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { setSignupApproval } from "../actions";
import { clearLogs, runLogCleanup, saveLogRetention } from "./actions";

export const metadata = { title: "Admin · Settings" };

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 truncate text-base font-semibold tabular-nums">{value}</div>
    </div>
  );
}

export default async function SettingsPage() {
  await requireAdmin();
  const requiresApproval = settingsService.signupRequiresApproval();
  const cfg = logRetentionService.getConfig();
  const stats = logRetentionService.stats();

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage platform configuration.</p>
      </div>

      {/* General */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">General</CardTitle>
          <CardDescription>Signup behaviour.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-medium">Signup approval</div>
              <p className="text-sm text-muted-foreground">
                {requiresApproval
                  ? "New signups require admin approval before they can log in."
                  : "New signups are active immediately."}
              </p>
            </div>
            <form action={setSignupApproval}>
              <input type="hidden" name="enabled" value={(!requiresApproval).toString()} />
              <Button type="submit" size="sm" variant={requiresApproval ? "default" : "outline"} className="shrink-0">
                {requiresApproval ? "Approval: On" : "Approval: Off"}
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>

      {/* Log retention & cleanup */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Log retention &amp; cleanup</CardTitle>
          <CardDescription>
            Control how long user and system logs are kept, and clear stored logs to free server
            storage.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Stat label="User log entries" value={stats.userTotal.toLocaleString()} />
            <Stat label="System log entries" value={stats.systemTotal.toLocaleString()} />
            <Stat label="Last auto-cleanup" value={stats.lastPrunedAt ?? "never"} />
          </div>

          <form action={saveLogRetention} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="userDays">Keep user logs for (days)</Label>
                <Input id="userDays" name="userDays" type="number" min={0} defaultValue={cfg.userDays} />
                <p className="text-xs text-muted-foreground">0 = keep forever.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="systemDays">Keep system logs for (days)</Label>
                <Input id="systemDays" name="systemDays" type="number" min={0} defaultValue={cfg.systemDays} />
                <p className="text-xs text-muted-foreground">0 = keep forever.</p>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="autoEnabled"
                defaultChecked={cfg.autoEnabled}
                className="size-4 rounded border-input accent-primary"
              />
              Automatically clear logs older than the retention period
            </label>
            <Button type="submit" size="sm">
              Save retention
            </Button>
          </form>

          <div className="space-y-3 rounded-md border p-4">
            <div className="text-sm font-medium">Manual cleanup</div>
            <div className="flex flex-wrap gap-2">
              <form action={runLogCleanup}>
                <Button type="submit" size="sm" variant="outline">
                  <Brush className="size-4" />
                  Run cleanup now
                </Button>
              </form>
              <form action={clearLogs}>
                <input type="hidden" name="type" value="user" />
                <ConfirmSubmit
                  variant="destructive"
                  confirm={`Delete ALL ${stats.userTotal.toLocaleString()} user log entries? This cannot be undone.`}
                >
                  <Trash2 className="size-4" />
                  Clear user logs
                </ConfirmSubmit>
              </form>
              <form action={clearLogs}>
                <input type="hidden" name="type" value="system" />
                <ConfirmSubmit
                  variant="destructive"
                  confirm={`Delete ALL ${stats.systemTotal.toLocaleString()} system log entries? This cannot be undone.`}
                >
                  <Trash2 className="size-4" />
                  Clear system logs
                </ConfirmSubmit>
              </form>
            </div>
            <p className="text-xs text-muted-foreground">
              &ldquo;Run cleanup now&rdquo; applies the retention period immediately. &ldquo;Clear&rdquo;
              permanently deletes every entry.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
