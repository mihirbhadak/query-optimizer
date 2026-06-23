import { FileText } from "lucide-react";

import { requireAdmin } from "@/lib/auth/dal";
import { EmptyState } from "@/components/admin/empty-state";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Workspace · Instructions" };

export default async function InstructionsTab() {
  await requireAdmin();
  return (
    <EmptyState
      icon={FileText}
      title="No instructions yet"
      description="Add workspace-level instructions that give the AI business context."
      action={<Button disabled>Add instruction</Button>}
    />
  );
}
