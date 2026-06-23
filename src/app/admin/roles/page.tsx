import { Shield } from "lucide-react";

import { requireAdmin } from "@/lib/auth/dal";
import { ComingSoon } from "@/components/admin/coming-soon";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Admin · Roles" };

export default async function Page() {
  await requireAdmin();
  return <ComingSoon title="Roles" icon={Shield} action={<Button disabled>New role</Button>} />;
}
