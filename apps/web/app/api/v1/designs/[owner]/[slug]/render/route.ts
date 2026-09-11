// Server-side render of the current version: SVG or Mermaid, through the shared engine.
import { normalize } from "@arkore/core/document";
import { toMermaid, toSvg } from "@arkore/core/render";
import { parse } from "@arkore/core/yaml";
import type { NextRequest } from "next/server";
import { handle, viewerOf } from "@/lib/api";
import { getCatalogue, getIcons } from "@/lib/catalogue";
import { getDesign } from "@/lib/designs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ owner: string; slug: string }> },
) {
  return handle(async () => {
    const { owner, slug } = await params;
    const p = req.nextUrl.searchParams;
    const view = await getDesign(owner, slug, await viewerOf(), {
      version: p.get("version") ?? undefined,
    });
    const doc = normalize(parse(view.version?.yaml ?? "").doc).doc;
    if (p.get("format") === "mermaid")
      return new Response(`${toMermaid(doc)}\n`, {
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    const svg = toSvg(doc, getCatalogue(), {
      icons: getIcons(),
      theme: (p.get("theme") as "auto" | "light" | "dark") ?? "light",
    });
    const download = p.get("download")
      ? `attachment; filename="${view.design.slug}.svg"`
      : "inline";
    return new Response(svg, {
      headers: {
        "content-type": "image/svg+xml; charset=utf-8",
        "content-disposition": download,
        "cache-control": "no-cache",
      },
    });
  });
}
