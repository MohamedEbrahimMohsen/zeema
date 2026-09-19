import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { createDesign } from "@/lib/designs";

export const dynamic = "force-dynamic";

// A new design starts as one component on the canvas: private, autosaved, and called a draft
// until its owner names it. The address is draft-<random> rather than a counted draft-1: a
// number would have to be looked up, and the owner renames it from the design page anyway.
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
    slug: `draft-${randomBytes(3).toString("hex")}`,
    visibility: "private",
    yaml: STARTER,
    message: "created",
  });
  redirect(`/d/${viewer.username}/${design.slug}/canvas`);
}
