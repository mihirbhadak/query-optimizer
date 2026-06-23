import { redirect } from "next/navigation";

export default async function DatabaseIndexPage({
  params,
}: {
  params: Promise<{ slug: string; name: string }>;
}) {
  const { slug, name } = await params;
  redirect(`/admin/workspaces/${slug}/databases/${encodeURIComponent(name)}/analytics`);
}
