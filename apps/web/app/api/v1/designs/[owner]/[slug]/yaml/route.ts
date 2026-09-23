import type { NextRequest } from "next/server";
import { handle, viewerOf } from "@/lib/api";
import { getDesign } from "@/lib/designs";
import { attachment } from "@/lib/http-guards";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ owner: string; slug: string }> },
) {
  return handle(async () => {
    const { owner, slug } = await params;
    const version = req.nextUrl.searchParams.get("version") ?? undefined;
    // Without this the browser shows the document; with it, it saves the file. Two links to one
    // representation rather than two endpoints returning the same bytes.
    const download = req.nextUrl.searchParams.get("download") === "1";
    const view = await getDesign(owner, slug, await viewerOf(), { version });
    const text = view.version?.yaml ?? "";
    const headers: Record<string, string> = {
      "content-type": "text/yaml; charset=utf-8",
      etag: `"${view.version?.contentHash ?? ""}"`,
      "cache-control": "no-cache",
    };
    // Named after the stored slug, never the address typed: the URL segment is caller text.
    if (download) headers["content-disposition"] = attachment(view.design.slug, "yaml");
    return new Response(text, { headers });
  });
}
