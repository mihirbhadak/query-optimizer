import { requireAdmin } from "@/lib/auth/dal";
import { systemLogService } from "@/lib/logs";
import { LogPagination } from "@/components/admin/log-pagination";
import { LogToolbar } from "@/components/admin/log-toolbar";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LogLevel } from "@/types/db";

export const metadata = { title: "Admin · System Logs" };

const PAGE_SIZE = 50;
const BASE = "/admin/system-logs";
const LEVELS: LogLevel[] = ["debug", "info", "warn", "error"];

const LEVEL_CLASS: Record<LogLevel, string> = {
  debug: "bg-muted text-muted-foreground",
  info: "bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300",
  warn: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
  error: "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300",
};

function LevelBadge({ level }: { level: LogLevel }) {
  return (
    <span
      className={cn(
        "inline-flex rounded px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wide",
        LEVEL_CLASS[level],
      )}
    >
      {level}
    </span>
  );
}

function MetaCell({ value }: { value: string | null }) {
  if (!value) return <span className="text-muted-foreground">—</span>;
  return (
    <span title={value} className="block max-w-[32ch] truncate font-mono text-xs text-muted-foreground">
      {value}
    </span>
  );
}

export default async function SystemLogsPage({
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
  const level = get("level");
  const source = get("source");
  const from = get("from");
  const to = get("to");
  const page = Math.max(1, Number(get("page")) || 1);

  const filter = {
    search: search || undefined,
    level: (LEVELS as string[]).includes(level) ? (level as LogLevel) : undefined,
    source: source || undefined,
    from: from || undefined,
    to: to || undefined,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  };

  const rows = systemLogService.query(filter);
  const total = systemLogService.count(filter);
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const sources = systemLogService.sources();

  const query: Record<string, string> = {};
  if (search) query.search = search;
  if (level) query.level = level;
  if (source) query.source = source;
  if (from) query.from = from;
  if (to) query.to = to;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">System logs</h1>
        <p className="text-sm text-muted-foreground">System events and errors across the platform.</p>
      </div>

      <LogToolbar
        basePath={BASE}
        search={search}
        from={from}
        to={to}
        selects={[
          {
            name: "level",
            placeholder: "All levels",
            value: level || "all",
            allValue: "all",
            options: LEVELS.map((l) => ({ value: l, label: l })),
          },
          {
            name: "source",
            placeholder: "All sources",
            value: source || "all",
            allValue: "all",
            options: sources.map((s) => ({ value: s, label: s })),
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
                  <th className="px-4 py-2 text-left font-medium">Level</th>
                  <th className="px-4 py-2 text-left font-medium">Source</th>
                  <th className="px-4 py-2 text-left font-medium">Message</th>
                  <th className="px-4 py-2 text-left font-medium">Details</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
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
                        <LevelBadge level={r.level} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-muted-foreground">
                        {r.source ?? "—"}
                      </td>
                      <td className="px-4 py-2">{r.message}</td>
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
