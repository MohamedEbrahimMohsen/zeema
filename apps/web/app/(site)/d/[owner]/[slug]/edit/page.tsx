import { notFound, redirect } from "next/navigation";
import { YamlEditor } from "@/components/YamlEditor";
import { currentUser } from "@/lib/auth";
import { getDesign, ownerSegment, ServiceError } from "@/lib/designs";

export const dynamic = "force-dynamic";

export default async function EditPage({
  params,
}: {
  params: Promise<{ owner: string; slug: string }>;
}) {
  const { owner, slug } = await params;
  const viewer = await currentUser();
  if (!viewer) redirect(`/signin?next=/d/${owner}/${slug}/edit`);
  let view: Awaited<ReturnType<typeof getDesign>>;
  try {
    view = await getDesign(owner, slug, viewer);
  } catch (e) {
    if (e instanceof ServiceError && e.status === 404) notFound();
    throw e;
  }
  if (!view.can.write) redirect(`/d/${owner}/${slug}`);
  return (
    <YamlEditor
      owner={ownerSegment(view.owner)}
      slug={view.design.slug}
      initialYaml={view.version?.yaml ?? ""}
      contentHash={view.version?.contentHash ?? ""}
      title={view.design.title}
    />
  );
}
