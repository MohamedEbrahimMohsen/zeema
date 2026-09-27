import { redirect } from "next/navigation";
import { ImportDesign } from "@/components/ImportDesign";
import { currentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata = { title: "Import a design · Zeema" };

// The way back in for a design that left as files: design.yaml, and optionally the
// design.layout.json beside it (or the zip the site packs them into). It becomes a private draft
// through the same create path as New design, under the same structural gate.
export default async function ImportPage() {
  const viewer = await currentUser();
  if (!viewer) redirect("/signin?next=/new/import");
  return <ImportDesign />;
}
