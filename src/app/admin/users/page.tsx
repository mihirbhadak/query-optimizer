import { Users } from "lucide-react";

import { requireAdmin } from "@/lib/auth/dal";
import { ComingSoon } from "@/components/admin/coming-soon";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Admin · Users" };

export default async function Page() {
  await requireAdmin();
  return <ComingSoon title="Users" icon={Users} action={<Button disabled>New user</Button>} />;
}
