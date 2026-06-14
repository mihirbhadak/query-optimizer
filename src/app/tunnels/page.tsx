import { notFound } from "next/navigation";

import TunnelDashboard from "@/components/TunnelDashboard";
import { dashboardEnabled } from "@/lib/ssh-tunnel/dashboard";

export const metadata = { title: "SSH Tunnels (temp)" };

export default function TunnelsPage() {
  if (!dashboardEnabled()) notFound();
  return (
    <main className="flex-1 bg-zinc-50 dark:bg-black">
      <TunnelDashboard />
    </main>
  );
}
