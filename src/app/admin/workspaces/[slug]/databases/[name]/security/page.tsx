import { KeyRound } from "lucide-react";

import { requireAdmin } from "@/lib/auth/dal";
import { EmptyState } from "@/components/admin/empty-state";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Database · Security" };

export default async function DatabaseSecurityTab() {
  await requireAdmin();
  return (
    <EmptyState
      icon={KeyRound}
      title="No secrets yet"
      description="Manage variables, secrets, and API keys scoped to this database."
      action={<Button disabled>Add secret</Button>}
    />
  );
}
