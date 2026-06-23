import { Database } from "lucide-react";

import { requireAdmin } from "@/lib/auth/dal";
import { EmptyState } from "@/components/admin/empty-state";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Workspace · Databases" };

export default async function DatabasesTab() {
  await requireAdmin();
  return (
    <EmptyState
      icon={Database}
      title="No databases yet"
      description="Connect a database (directly or via SSH tunnel) to this workspace."
      action={<Button disabled>Add database</Button>}
    />
  );
}
