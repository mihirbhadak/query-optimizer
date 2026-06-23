import { FileText } from "lucide-react";

import { requireAdmin } from "@/lib/auth/dal";
import { EmptyState } from "@/components/admin/empty-state";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Database · Instructions" };

export default async function DatabaseInstructionsTab() {
  await requireAdmin();
  return (
    <EmptyState
      icon={FileText}
      title="No instructions yet"
      description="Add database-level instructions that give the AI context about this database."
      action={<Button disabled>Add instruction</Button>}
    />
  );
}
