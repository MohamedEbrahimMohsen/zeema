import { notFound, redirect } from "next/navigation";
import { Canvas } from "@/canvas/Canvas";
import { actingAdmin, currentUser, isAdmin } from "@/lib/auth";
import { badgeOf } from "@/lib/badge";
import { badgeChoices, badgeMark } from "@/lib/brand";
import { getCatalogue } from "@/lib/catalogue";
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
  // The list badge chooser in Design settings, for the owner only: the marks are read from disk
  // here. The choice itself comes from the sidecar the canvas holds, and automatic is worked out
  // there from the live document, except for a design with a brand, answered here by its slug.
  const cat = view.can.write ? getCatalogue() : null;
  const badgeMenu = cat
    ? {
        current: null,
        auto: badgeMark(badgeOf(null, cat, view.design.slug), cat),
        ...badgeChoices(cat),
      }
    : undefined;
  return (
    <Canvas
      owner={ownerSegment(view.owner)}
      slug={view.design.slug}
      title={view.design.title}
      yaml={view.version?.yaml ?? ""}
      layoutSidecar={view.version?.layout ?? null}
      contentHash={view.version?.contentHash ?? ""}
      canWrite={view.can.write}
      unpublished={view.unpublished}
      canClone={view.can.clone}
      signedIn={Boolean(viewer)}
      canDelete={view.can.write && view.design.origin === "authored"}
      badgeMenu={badgeMenu}
      user={
        viewer
          ? {
              username: viewer.username,
              displayName: viewer.displayName,
              avatarUrl: viewer.avatarUrl,
              isAdmin: isAdmin(viewer),
              actingAdmin: actingAdmin(viewer),
            }
          : null
      }
    />
  );
}
