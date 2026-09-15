import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { createDesign } from "@/lib/designs";

export const dynamic = "force-dynamic";

// A new design starts as one component on the canvas: private, autosaved, named
// <username>-<random> until its owner renames it from the canvas title.
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
  const name = `${viewer.username}-${randomBytes(3).toString("hex")}`;
  const { design } = await createDesign(viewer, {
    title: name,
    slug: name,
    visibility: "private",
    yaml: STARTER,
    message: "created",
  });
  redirect(`/d/${viewer.username}/${design.slug}/canvas`);
}
