"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Database,
  Eye,
  KeyRound,
  RefreshCw,
  Search,
  TriangleAlert,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PHASE_LABEL, type SyncJobView } from "@/lib/db-introspect/types";
import type { DbColumn, DbIndex, DbTable } from "@/types/db";

import { startSchemaSync } from "./actions";

type TreeItem = { table: DbTable; columns: DbColumn[]; indexes: DbIndex[] };
type Summary = { tableCount: number; totalSizeBytes: number; totalRows: number; lastSyncAt: string | null };
type LastSync = { label: string; isStale: boolean };
type SortKey = "size" | "rows" | "name" | "columns" | "indexes";

const SORTS: { value: SortKey; label: string }[] = [
  { value: "size", label: "Largest size" },
  { value: "rows", label: "Most rows" },
  { value: "columns", label: "Most columns" },
  { value: "indexes", label: "Most indexes" },
  { value: "name", label: "Name (A–Z)" },
];

function fmtBytes(n: number): string {
  if (!n) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}
const fmtNum = (n: number) => n.toLocaleString();
function indexColumns(ix: DbIndex): string {
  try {
    const cols = JSON.parse(ix.columns ?? "[]") as { name: string; subPart?: number | null }[];
    return cols.map((c) => (c.subPart ? `${c.name}(${c.subPart})` : c.name)).join(", ");
  } catch {
    return "";
  }
}
const isView = (t: DbTable) => (t.table_type ?? "").toUpperCase().includes("VIEW");

/** Wrap case-insensitive matches of `q` in a highlight span. */
function highlight(text: string, q: string) {
  if (!q) return text;
  const lower = text.toLowerCase();
  const out: React.ReactNode[] = [];
  let i = 0;
  let n = 0;
  while (i < text.length) {
    const at = lower.indexOf(q, i);
    if (at === -1) {
      out.push(text.slice(i));
      break;
    }
    if (at > i) out.push(text.slice(i, at));
    out.push(
      <mark key={n++} className="rounded bg-amber-200/70 px-0.5 text-inherit dark:bg-amber-500/30">
        {text.slice(at, at + q.length)}
      </mark>,
    );
    i = at + q.length;
  }
  return out;
}

const isActiveStatus = (s: SyncJobView | null) =>
  s !== null && (s.status === "queued" || s.status === "running");

export function SchemaSyncPanel({
  slug,
  name,
  engine,
  initialSummary,
  initialStatus,
  initialLastSync,
  tree,
}: {
  slug: string;
  name: string;
  engine: string;
  initialSummary: Summary;
  initialStatus: SyncJobView | null;
  initialLastSync: LastSync;
  tree: TreeItem[];
}) {
  const router = useRouter();
  const [status, setStatus] = useState<SyncJobView | null>(initialStatus);
  const [summary, setSummary] = useState<Summary>(initialSummary);
  const [lastSync, setLastSync] = useState<LastSync>(initialLastSync);
  const [pending, startTransition] = useTransition();

  // Filtering / sorting / expansion
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("size");
  const [engineFilter, setEngineFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "table" | "view">("all");
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const statusUrl = `/admin/workspaces/${slug}/databases/${encodeURIComponent(name)}/sync/status`;
  const active = isActiveStatus(status);
  const stale = lastSync.isStale;
  const q = search.trim().toLowerCase();

  // Poll while a job is queued/running; refresh stored data when it finishes.
  useEffect(() => {
    if (!active) return;
    let alive = true;
    const tick = async () => {
      try {
        const res = await fetch(statusUrl, { cache: "no-store" });
        if (!res.ok || !alive) return;
        const data = (await res.json()) as {
          status: SyncJobView | null;
          summary: Summary;
          lastSync: LastSync;
        };
        if (!alive) return;
        setStatus(data.status);
        setSummary(data.summary);
        setLastSync(data.lastSync);
        if (data.status && !isActiveStatus(data.status)) router.refresh();
      } catch {
        /* transient; keep polling */
      }
    };
    const iv = setInterval(tick, 1200);
    return () => {
      alive = false;
      clearInterval(iv);
    };
  }, [active, statusUrl, router]);

  const engines = useMemo(() => {
    const set = new Set<string>();
    for (const { table } of tree) if (table.engine) set.add(table.engine);
    return Array.from(set).sort();
  }, [tree]);

  // Filter + sort. Each item knows how many of its columns matched the search.
  const rows = useMemo(() => {
    const filtered = tree
      .filter(({ table }) => {
        if (engineFilter !== "all" && table.engine !== engineFilter) return false;
        if (typeFilter === "view" && !isView(table)) return false;
        if (typeFilter === "table" && isView(table)) return false;
        return true;
      })
      .map((item) => {
        const matchingColumns = q
          ? item.columns.filter((c) => c.name.toLowerCase().includes(q))
          : item.columns;
        const nameMatch = q ? item.table.name.toLowerCase().includes(q) : true;
        return { ...item, matchingColumns, nameMatch, colMatch: q ? matchingColumns.length > 0 : false };
      })
      .filter((item) => !q || item.nameMatch || item.colMatch);

    filtered.sort((a, b) => {
      switch (sort) {
        case "rows":
          return b.table.row_count - a.table.row_count;
        case "columns":
          return b.table.column_count - a.table.column_count;
        case "indexes":
          return b.table.index_count - a.table.index_count;
        case "name":
          return a.table.name.localeCompare(b.table.name);
        default:
          return b.table.size_bytes - a.table.size_bytes;
      }
    });
    return filtered;
  }, [tree, q, sort, engineFilter, typeFilter]);

  const shownCols = rows.reduce((n, r) => n + r.table.column_count, 0);
  const shownIdx = rows.reduce((n, r) => n + r.table.index_count, 0);

  const toggle = (id: number) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const expandAll = () => setExpanded(new Set(rows.map((r) => r.table.id)));
  const collapseAll = () => setExpanded(new Set());
  const allOpen = rows.length > 0 && rows.every((r) => expanded.has(r.table.id));

  const onSync = () =>
    startTransition(async () => {
      const res = await startSchemaSync(slug, name);
      setStatus({
        jobId: res.jobId,
        databaseId: 0,
        status: res.status,
        phase: res.status === "running" ? "connecting" : "queued",
        progress: 0,
        tablesDone: 0,
        tablesTotal: 0,
        engine: null,
        engineVersion: null,
        tableCount: null,
        totalSizeBytes: null,
        error: null,
        trigger: "manual",
        startedAt: null,
        finishedAt: null,
        durationMs: null,
      });
    });

  const syncing = active || pending;
  const hasData = tree.length > 0;

  return (
    <div className="space-y-6">
      {/* Overview + actions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base">Schema metadata</CardTitle>
            <Button onClick={onSync} disabled={syncing} size="sm" className="shrink-0">
              <RefreshCw className={cn("size-4", syncing && "animate-spin")} />
              {syncing ? "Syncing…" : summary.lastSyncAt ? "Re-sync" : "Sync now"}
            </Button>
          </div>
          <CardDescription>
            Structure only (tables, columns, indexes, sizes) — read with low-cost dictionary
            queries. No customer data is copied.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Metric label="Tables" value={fmtNum(summary.tableCount)} />
            <Metric label="Est. rows" value={fmtNum(summary.totalRows)} />
            <Metric label="Total size" value={fmtBytes(summary.totalSizeBytes)} />
            <Metric label="Last synced" value={lastSync.label} />
          </div>

          {active ? <ProgressBar status={status!} /> : null}

          {status?.status === "failed" ? (
            <Banner tone="error" icon={<TriangleAlert className="size-4" />}>
              Last sync failed: {status.error ?? "unknown error"}
            </Banner>
          ) : null}

          {!active && stale ? (
            <Banner tone="warn" icon={<TriangleAlert className="size-4" />}>
              {summary.lastSyncAt
                ? `Schema was last synced ${lastSync.label} — sync to refresh it.`
                : "This database hasn't been synced yet — sync to read its structure."}
            </Banner>
          ) : null}
        </CardContent>
      </Card>

      {/* Tables */}
      <Card>
        <CardHeader className="space-y-3">
          <div>
            <CardTitle className="text-base">
              Tables{" "}
              {summary.tableCount > 0 ? (
                <span className="text-muted-foreground">({summary.tableCount})</span>
              ) : null}
            </CardTitle>
            <CardDescription>
              {engine} · click a table to inspect its columns and indexes.
            </CardDescription>
          </div>

          {hasData ? (
            <div className="space-y-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search tables or columns…"
                  className="pl-8 pr-8"
                />
                {search ? (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    aria-label="Clear search"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-4" />
                  </button>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
                  <SelectTrigger size="sm" className="min-w-0 flex-1 sm:flex-none sm:w-[150px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SORTS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {engines.length > 1 ? (
                  <Select value={engineFilter} onValueChange={setEngineFilter}>
                    <SelectTrigger size="sm" className="min-w-0 flex-1 sm:flex-none sm:w-[130px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All engines</SelectItem>
                      {engines.map((e) => (
                        <SelectItem key={e} value={e}>
                          {e}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : null}

                <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as typeof typeFilter)}>
                  <SelectTrigger size="sm" className="min-w-0 flex-1 sm:flex-none sm:w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All types</SelectItem>
                    <SelectItem value="table">Tables</SelectItem>
                    <SelectItem value="view">Views</SelectItem>
                  </SelectContent>
                </Select>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={allOpen ? collapseAll : expandAll}
                  className="ml-auto"
                >
                  {allOpen ? <ChevronsDownUp className="size-4" /> : <ChevronsUpDown className="size-4" />}
                  {allOpen ? "Collapse all" : "Expand all"}
                </Button>
              </div>
            </div>
          ) : null}

          {hasData ? (
            <p className="text-xs text-muted-foreground">
              Showing {fmtNum(rows.length)} of {fmtNum(tree.length)} tables · {fmtNum(shownCols)} columns ·{" "}
              {fmtNum(shownIdx)} indexes
            </p>
          ) : null}
        </CardHeader>

        <CardContent>
          {!hasData ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No schema stored yet. Run a sync to populate tables, columns, and indexes.
            </p>
          ) : rows.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No tables match {search ? `"${search}"` : "the current filters"}.
            </p>
          ) : (
            <div className="divide-y overflow-hidden rounded-md border">
              {rows.map(({ table, columns, indexes, matchingColumns, colMatch }) => {
                const open = expanded.has(table.id);
                const view = isView(table);
                return (
                  <div key={table.id}>
                    <button
                      type="button"
                      onClick={() => toggle(table.id)}
                      className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left hover:bg-muted/50"
                    >
                      <ChevronRight
                        className={cn(
                          "size-4 shrink-0 text-muted-foreground transition-transform",
                          open && "rotate-90",
                        )}
                      />
                      {view ? (
                        <Eye className="size-4 shrink-0 text-muted-foreground" />
                      ) : (
                        <Database className="size-4 shrink-0 text-muted-foreground" />
                      )}
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">
                        {highlight(table.name, q)}
                        {view ? (
                          <Badge variant="outline" className="ml-2 text-[10px]">
                            VIEW
                          </Badge>
                        ) : null}
                        {q && colMatch && !table.name.toLowerCase().includes(q) ? (
                          <span className="ml-2 text-xs font-normal text-amber-600 dark:text-amber-500">
                            {matchingColumns.length} col{matchingColumns.length === 1 ? "" : "s"} match
                          </span>
                        ) : null}
                      </span>
                      {table.engine ? (
                        <Badge variant="secondary" className="hidden shrink-0 text-[10px] md:inline-flex">
                          {table.engine}
                        </Badge>
                      ) : null}
                      <span className="hidden shrink-0 gap-2 text-xs text-muted-foreground sm:flex">
                        <span>{fmtNum(table.row_count)} rows</span>
                        <span>·</span>
                        <span>{fmtBytes(table.size_bytes)}</span>
                      </span>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        {table.column_count} cols · {table.index_count} idx
                      </span>
                    </button>
                    {open ? (
                      <TableDetail columns={columns} indexes={indexes} query={q} />
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 truncate text-base font-semibold tabular-nums sm:text-lg">{value}</div>
    </div>
  );
}

function ProgressBar({ status }: { status: SyncJobView }) {
  const label = status.phase ? PHASE_LABEL[status.phase] : "Working";
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium">
          {label}
          {status.tablesTotal > 0 ? ` · ${status.tablesDone}/${status.tablesTotal} tables` : ""}
        </span>
        <span className="tabular-nums text-muted-foreground">{status.progress}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: `${Math.max(5, status.progress)}%` }}
        />
      </div>
    </div>
  );
}

function Banner({
  tone,
  icon,
  children,
}: {
  tone: "warn" | "error";
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md border px-3 py-2 text-sm",
        tone === "warn"
          ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200"
          : "border-red-300 bg-red-50 text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200",
      )}
    >
      <span className="shrink-0">{icon}</span>
      <span>{children}</span>
    </div>
  );
}

function TableDetail({
  columns,
  indexes,
  query,
}: {
  columns: DbColumn[];
  indexes: DbIndex[];
  query: string;
}) {
  // When searching, surface matching columns first.
  const matched = query ? columns.filter((c) => c.name.toLowerCase().includes(query)) : [];
  const shown = query && matched.length > 0 ? matched : columns;

  return (
    <div className="space-y-4 border-t bg-muted/30 px-3 py-3">
      <div>
        <div className="mb-1.5 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <span>Columns</span>
          {query && matched.length > 0 && matched.length !== columns.length ? (
            <span className="font-normal normal-case">
              {matched.length} of {columns.length} match
            </span>
          ) : null}
        </div>
        <div className="overflow-x-auto rounded border bg-background">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr className="border-b">
                <th className="px-2 py-1.5 text-left font-medium">Name</th>
                <th className="px-2 py-1.5 text-left font-medium">Type</th>
                <th className="px-2 py-1.5 text-left font-medium">Null</th>
                <th className="px-2 py-1.5 text-left font-medium">Key</th>
                <th className="px-2 py-1.5 text-left font-medium">Default</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((c) => (
                <tr key={c.id} className="border-b last:border-0">
                  <td className="px-2 py-1.5 font-medium">
                    <span className="inline-flex items-center gap-1">
                      {c.is_primary_key ? <KeyRound className="size-3 text-amber-500" /> : null}
                      {highlight(c.name, query)}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 font-mono text-xs text-muted-foreground">
                    {c.column_type ?? c.data_type ?? "—"}
                  </td>
                  <td className="px-2 py-1.5 text-xs">{c.is_nullable ? "YES" : "NO"}</td>
                  <td className="px-2 py-1.5 text-xs">{c.column_key || "—"}</td>
                  <td className="px-2 py-1.5 font-mono text-xs text-muted-foreground">
                    {c.default_value ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Indexes ({indexes.length})
        </div>
        {indexes.length === 0 ? (
          <p className="text-xs text-muted-foreground">No indexes.</p>
        ) : (
          <ul className="space-y-1">
            {indexes.map((ix) => (
              <li
                key={ix.id}
                className="flex flex-wrap items-center gap-2 rounded border bg-background px-2 py-1.5 text-sm"
              >
                <span className="font-medium">{ix.name}</span>
                {ix.is_primary ? <Badge variant="secondary" className="text-[10px]">PRIMARY</Badge> : null}
                {ix.is_unique && !ix.is_primary ? (
                  <Badge variant="outline" className="text-[10px]">UNIQUE</Badge>
                ) : null}
                <span className="font-mono text-xs text-muted-foreground">({indexColumns(ix)})</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {ix.index_type ?? ""}
                  {ix.size_bytes ? ` · ${fmtBytes(ix.size_bytes)}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
