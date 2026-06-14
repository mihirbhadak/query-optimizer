import { notFound } from "next/navigation";

import DatabaseDashboard from "./DatabaseDashboard";
import { dashboardEnabled } from "@/lib/ssh-tunnel/dashboard";

export const metadata = { title: "Databases (temp)" };

export default function DatabasesPage() {
  if (!dashboardEnabled()) notFound();
  return (
    <main className="flex-1 bg-zinc-50 dark:bg-black">
      <DatabaseDashboard />
    </main>
  );
}
