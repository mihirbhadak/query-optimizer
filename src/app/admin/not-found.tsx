import Link from "next/link";

import { Button } from "@/components/ui/button";

export const metadata = { title: "Not found" };

export default function AdminNotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="flex max-w-md flex-col items-center text-center">
        <p className="text-sm font-semibold tracking-[0.2em] text-muted-foreground">404</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">Not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This workspace, database, or page doesn’t exist or may have been removed.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button asChild>
            <Link href="/admin/workspaces">Back to workspaces</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin/dashboard">Admin dashboard</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
