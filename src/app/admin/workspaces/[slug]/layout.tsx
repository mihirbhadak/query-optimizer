import { notFound } from "next/navigation";

import { requireAdmin } from "@/lib/auth/dal";
import { workspaceService } from "@/lib/workspaces";

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  await requireAdmin();
  const { slug } = await params;
  if (!workspaceService.getBySlug(slug)) notFound();

  return <div className="p-4 md:p-6">{children}</div>;
}
