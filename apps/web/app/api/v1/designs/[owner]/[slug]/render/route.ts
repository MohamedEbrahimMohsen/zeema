// Server-side render of the current version: SVG or Mermaid, through the shared engine.
//
// The SVG is served from the app's own origin, so it is locked down as a document of its own:
// `sandbox` and `default-src 'none'` mean an SVG opened directly can run nothing and fetch
// nothing, whatever it contains. Its <style> block is the only thing allowed.
//
// `?download=svg|png` (or `1`, meaning svg) is an export, and this is where exports are
// counted: the server is performing it. The PNG path fetches this SVG to rasterise it.
import { normalize } from "@zeema/core/document";
import { toMermaid, toSvg } from "@zeema/core/render";
import { parse } from "@zeema/core/yaml";
import type { NextRequest } from "next/server";
import { clientIp, firstInHour, handle, viewerOf } from "@/lib/api";
import { getCatalogue, getIcons } from "@/lib/catalogue";
import { getDesign, recordEvent } from "@/lib/designs";
import { attachment } from "@/lib/http-guards";
import { readSidecar } from "@/lib/layout-sidecar";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ owner: string; slug: string }> },
) {
  return handle(async () => {
    const { owner, slug } = await params;
    const p = req.nextUrl.searchParams;
    const viewer = await viewerOf();
    const view = await getDesign(owner, slug, viewer, {
      version: p.get("version") ?? undefined,
    });
    const download = p.get("download");
    if (download) {
      const format = download === "png" ? "png" : "svg";
      const ip = clientIp(req);
      if (firstInHour(`export:${viewer?.id ?? ip}:${view.design.id}`))
        await recordEvent(view.design.id, viewer, "export", { format, ip }).catch(() => false);
    }
    const doc = normalize(parse(view.version?.yaml ?? "").doc).doc;
    if (p.get("format") === "mermaid")
      return new Response(`${toMermaid(doc)}\n`, {
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    // What you download is what the page shows: the drawing as its owner left it on the canvas,
    // and the engine's own arrangement only when nobody has drawn one.
    const svg = toSvg(doc, getCatalogue(), {
      icons: getIcons(),
      theme: (p.get("theme") as "auto" | "light" | "dark") ?? "light",
      layout: readSidecar(view.version?.layout),
    });
    return new Response(svg, {
      headers: {
        "content-type": "image/svg+xml; charset=utf-8",
        "content-disposition": download ? attachment(view.design.slug, "svg") : "inline",
        "content-security-policy": "sandbox; default-src 'none'; style-src 'unsafe-inline'",
        "cache-control": "no-cache",
      },
    });
  });
}
