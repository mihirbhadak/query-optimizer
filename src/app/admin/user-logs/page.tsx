import { requireAdmin } from "@/lib/auth/dal";
import { userLogService } from "@/lib/users";
import { LogPagination } from "@/components/admin/log-pagination";
import { LogToolbar } from "@/components/admin/log-toolbar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = { title: "Admin · User Logs" };

const PAGE_SIZE = 50;
const BASE = "/admin/user-logs";

function MetaCell({ value }: { value: string | null }) {
  if (!value) return <span className="text-muted-foreground">—</span>;
  return (
    <span title={value} className="block max-w-[28ch] truncate font-mono text-xs text-muted-foreground">
      {value}
    </span>
  );
}

export default async function UserLogsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const get = (k: string) => {
    const v = sp[k];
    return (Array.isArray(v) ? v[0] : v) ?? "";
  };

  const search = get("search");
  const action = get("action");
  const from = get("from");
  const to = get("to");
  const page = Math.max(1, Number(get("page")) || 1);

  const filter = {
    search: search || undefined,
    action: action || undefined,
    from: from || undefined,
    to: to || undefined,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  };

  const rows = userLogService.query(filter);
  const total = userLogService.count(filter);
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const actions = userLogService.actions();

  const query: Record<string, string> = {};
  if (search) query.search = search;
  if (action) query.action = action;
  if (from) query.from = from;
  if (to) query.to = to;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">User logs</h1>
        <p className="text-sm text-muted-foreground">Audit trail of actions performed by users.</p>
      </div>

      <LogToolbar
        basePath={BASE}
        search={search}
        from={from}
        to={to}
        selects={[
          {
            name: "action",
            placeholder: "All actions",
            value: action || "all",
            allValue: "all",
            options: actions.map((a) => ({ value: a, label: a })),
          },
        ]}
      />

      <Card>
        <CardContent className="px-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b">
                  <th className="px-4 py-2 text-left font-medium">Time</th>
                  <th className="px-4 py-2 text-left font-medium">Action</th>
                  <th className="px-4 py-2 text-left font-medium">User</th>
                  <th className="px-4 py-2 text-left font-medium">Target</th>
                  <th className="px-4 py-2 text-left font-medium">IP</th>
                  <th className="px-4 py-2 text-left font-medium">Details</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                      No log entries match the current filters.
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => (
                    <tr key={r.id} className="border-b last:border-0 hover:bg-muted/40">
                      <td className="whitespace-nowrap px-4 py-2 font-mono text-xs text-muted-foreground">
                        {r.created_at}
                      </td>
                      <td className="px-4 py-2">
                        <Badge variant="secondary" className="font-mono text-[11px]">
                          {r.action}
                        </Badge>
                      </td>
                      <td className="whitespace-nowrap px-4 py-2">
                        {r.username ?? (r.user_id ? `#${r.user_id}` : <span className="text-muted-foreground">system</span>)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-muted-foreground">
                        {r.target_type ? `${r.target_type}${r.target_id ? ` #${r.target_id}` : ""}` : "—"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 font-mono text-xs text-muted-foreground">
                        {r.ip_address ?? "—"}
                      </td>
                      <td className="px-4 py-2">
                        <MetaCell value={r.metadata} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="px-4">
            <LogPagination basePath={BASE} query={query} page={page} pageCount={pageCount} total={total} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
