"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RefreshCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PHASE_LABEL, type SyncPhase } from "@/lib/db-introspect/types";

interface ActiveJob {
  jobId: number;
  databaseId: number;
  databaseName: string;
  workspaceSlug: string;
  status: "queued" | "running";
  phase: SyncPhase | null;
  progress: number;
  tablesDone: number;
  tablesTotal: number;
}

/** Live schema-sync activity across all databases (polls /admin/sync/active). */
export function ActiveSyncs() {
  const [jobs, setJobs] = useState<ActiveJob[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const res = await fetch("/admin/sync/active", { cache: "no-store" });
        if (!res.ok || !alive) return;
        const data = (await res.json()) as { jobs: ActiveJob[] };
        if (!alive) return;
        setJobs(data.jobs ?? []);
        setLoaded(true);
      } catch {
        /* transient */
      }
    };
    tick();
    const iv = setInterval(tick, 1500);
    return () => {
      alive = false;
      clearInterval(iv);
    };
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <RefreshCw className={jobs.length ? "size-4 animate-spin" : "size-4"} />
          Schema syncs
        </CardTitle>
        <CardDescription>Live database introspection jobs.</CardDescription>
      </CardHeader>
      <CardContent>
        {jobs.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {loaded ? "No active syncs." : "Loading…"}
          </p>
        ) : (
          <ul className="space-y-3">
            {jobs.map((j) => (
              <li key={j.jobId} className="space-y-1.5">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <Link
                    href={`/admin/workspaces/${j.workspaceSlug}/databases/${encodeURIComponent(j.databaseName)}/schema`}
                    className="truncate font-medium hover:underline"
                  >
                    {j.databaseName}
                  </Link>
                  <Badge variant={j.status === "running" ? "default" : "secondary"} className="shrink-0 text-[10px]">
                    {j.status === "running" ? (j.phase ? PHASE_LABEL[j.phase] : "Running") : "Queued"}
                  </Badge>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-500"
                    style={{ width: `${Math.max(5, j.progress)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
