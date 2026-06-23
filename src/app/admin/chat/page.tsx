import { MessageSquare } from "lucide-react";

import { requireAdmin } from "@/lib/auth/dal";
import { ComingSoon } from "@/components/admin/coming-soon";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Admin · Chat" };

export default async function Page() {
  await requireAdmin();
  return <ComingSoon title="Chat" icon={MessageSquare} action={<Button disabled>New chat</Button>} />;
}
