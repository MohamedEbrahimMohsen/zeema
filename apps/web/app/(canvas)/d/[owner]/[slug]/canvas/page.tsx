import { notFound, redirect } from "next/navigation";
import { Canvas } from "@/canvas/Canvas";
import { currentUser } from "@/lib/auth";
import { getDesign, ownerSegment, resolveAlias, ServiceError } from "@/lib/designs";

export const dynamic = "force-dynamic";

export default async function CanvasPage({
  params,
}: {
  params: Promise<{ owner: string; slug: string }>;
}) {
  const { owner, slug } = await params;
  const viewer = await currentUser();
  let view: Awaited<ReturnType<typeof getDesign>>;
  try {
    view = await getDesign(owner, slug, viewer);
  } catch (e) {
    if (e instanceof ServiceError && e.status === 404) {
      const now = await resolveAlias(owner, slug);
      if (now) redirect(`/d/${owner}/${now}/canvas`);
      notFound();
    }
    throw e;
  }
  return (
    <Canvas
      owner={ownerSegment(view.owner)}
      slug={view.design.slug}
      title={view.design.title}
      yaml={view.version?.yaml ?? ""}
      layoutSidecar={
        (view.version?.layout as {
          version: number;
          nodes?: Record<string, [number, number]>;
          edges?: Record<string, number>;
        } | null) ?? null
      }
      contentHash={view.version?.contentHash ?? ""}
      canWrite={view.can.write}
      unpublished={view.unpublished}
      canClone={view.can.clone}
      signedIn={Boolean(viewer)}
    />
  );
}
