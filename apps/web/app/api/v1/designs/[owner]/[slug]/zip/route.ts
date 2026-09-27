// The design as a folder: `design.yaml` and `design.layout.json` in one stored zip, the names a
// repository design folder uses, so unzipped it is a design the CLI renders as drawn. Same
// authorization and `version` as the YAML download (a private design is a 404 to others).
import type { NextRequest } from "next/server";
import { handle, viewerOf } from "@/lib/api";
import { designZip } from "@/lib/design-files";
import { getDesign } from "@/lib/designs";
import { attachment } from "@/lib/http-guards";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ owner: string; slug: string }> },
) {
  return handle(async () => {
    const { owner, slug } = await params;
    const version = req.nextUrl.searchParams.get("version") ?? undefined;
    const view = await getDesign(owner, slug, await viewerOf(), { version });
    const at = view.version?.createdAt ? new Date(view.version.createdAt) : new Date(0);
    const bytes = designZip(view.version?.yaml ?? "", view.version?.layout ?? null, at);
    return new Response(bytes as BodyInit, {
      headers: {
        "content-type": "application/zip",
        "content-disposition": attachment(view.design.slug, "zip"),
        etag: `"${view.version?.contentHash ?? ""}"`,
        "cache-control": "no-cache",
      },
    });
  });
}
