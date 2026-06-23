import { Users } from "lucide-react";

import { requireAdmin } from "@/lib/auth/dal";
import { EmptyState } from "@/components/admin/empty-state";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Database · Users" };

export default async function DatabaseUsersTab() {
  await requireAdmin();
  return (
    <EmptyState
      icon={Users}
      title="No database users yet"
      description="Manage which users can access this database and their permissions."
      action={<Button disabled>Add user</Button>}
    />
  );
}
