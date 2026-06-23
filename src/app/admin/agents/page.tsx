import { Bot } from "lucide-react";

import { requireAdmin } from "@/lib/auth/dal";
import { ComingSoon } from "@/components/admin/coming-soon";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Admin · Agents" };

export default async function Page() {
  await requireAdmin();
  return <ComingSoon title="Agents" icon={Bot} action={<Button disabled>New agent</Button>} />;
}
