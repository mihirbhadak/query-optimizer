import { requireAdmin } from "@/lib/auth/dal";
import { ComingSoon } from "@/components/admin/coming-soon";

export const metadata = { title: "Admin · Users" };

export default async function Page() {
  await requireAdmin();
  return <ComingSoon title="Users" />;
}
