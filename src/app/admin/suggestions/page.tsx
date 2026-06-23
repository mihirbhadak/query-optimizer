import { Lightbulb } from "lucide-react";

import { requireAdmin } from "@/lib/auth/dal";
import { ComingSoon } from "@/components/admin/coming-soon";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Admin · Suggestions" };

export default async function Page() {
  await requireAdmin();
  return <ComingSoon title="Suggestions" icon={Lightbulb} action={<Button disabled>New suggestion</Button>} />;
}
