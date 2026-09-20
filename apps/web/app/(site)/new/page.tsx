import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { createDesign } from "@/lib/designs";
import { newDraftSlug } from "@/lib/slug";

export const dynamic = "force-dynamic";

// A new design starts as one component on the canvas: private, autosaved, and called a draft
// until its owner names it. The address is draft-<random> rather than a counted draft-1: a
// number would have to be looked up. Publishing grows the address out of the title (see
// `publishSlugFor`), and the owner can rename it by hand at any time.
const STARTER = `schemaVersion: "1"
type: "design"
id: "new-design"
nodes:
  - { id: "service", component: "container-service" }
edges: []
`;

export default async function NewPage() {
  const viewer = await currentUser();
  if (!viewer) redirect("/signin?next=/new");
  const { design } = await createDesign(viewer, {
    title: "Untitled design",
    slug: newDraftSlug(),
    visibility: "private",
    yaml: STARTER,
    message: "created",
  });
  redirect(`/d/${viewer.username}/${design.slug}/canvas`);
}
