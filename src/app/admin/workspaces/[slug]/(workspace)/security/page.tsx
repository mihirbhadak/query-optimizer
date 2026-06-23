import { KeyRound } from "lucide-react";

import { requireAdmin } from "@/lib/auth/dal";
import { EmptyState } from "@/components/admin/empty-state";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Workspace · Security" };

export default async function SecurityTab() {
  await requireAdmin();
  return (
    <EmptyState
      icon={KeyRound}
      title="No secrets yet"
      description="Manage variables, secrets, and API keys for this workspace."
      action={<Button disabled>Add secret</Button>}
    />
  );
}
