import { redirect } from "next/navigation";

export default async function WorkspaceIndexPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirect(`/admin/workspaces/${slug}/analytics`);
}
