// A design's list thumbnail: the engine's own SVG of the version the list shows, drawn as it was
// left on the canvas, on the row card's own colour so the picture and the card are one surface. The URL carries the version
// and its thumb key; when the key is current the picture can never change, so it is cached for a
// year, publicly only when anyone may read it. Authorization is getDesign's, as everywhere.
import { normalize } from "@zeema/core/document";
import { toSvg } from "@zeema/core/render";
import { parse } from "@zeema/core/yaml";
import { getCatalogue, getIcons } from "./catalogue";
import { getDesign, type Viewer } from "./designs";
import { readSidecar } from "./layout-sidecar";
import { thumbKey } from "./thumb-key";

export type ThumbQuery = {
  version?: string;
  v?: string;
  theme?: string;
  ifNoneMatch?: string | null;
};

const YEAR = 31_536_000;

/** The site's --panel per theme (app/globals.css), which the row's thumb box is painted with.
 *  The engine's own --bg is close but not equal in dark, and it shows under tinted groups. */
const PANEL = { light: "#ffffff", dark: "#1b1b1f" } as const;

/** Does an If-None-Match header name this etag (a list, `*`, or a weak form)? */
function matches(header: string | null | undefined, etag: string) {
  if (!header) return false;
  return header
    .split(",")
    .map((t) => t.trim().replace(/^W\//, ""))
    .some((t) => t === "*" || t === etag);
}

export async function thumbResponse(
  owner: string,
  slug: string,
  viewer: Viewer,
  q: ThumbQuery,
): Promise<Response> {
  const view = await getDesign(owner, slug, viewer, { version: q.version || undefined });
  const theme = q.theme === "dark" ? "dark" : "light";
  const key = view.version ? thumbKey(view.version.contentHash, view.version.layout) : "empty";
  const etag = `"${key}-${theme}"`;
  // Anyone may read a released version of a public design; anything else is the viewer's own.
  const shared = view.design.visibility === "public" && Boolean(view.version?.publishedAt);
  const headers: Record<string, string> = {
    "content-type": "image/svg+xml; charset=utf-8",
    "content-disposition": "inline",
    "content-security-policy": "sandbox; default-src 'none'; style-src 'unsafe-inline'",
    "x-content-type-options": "nosniff",
    "cache-control":
      q.v && q.v === key
        ? `${shared ? "public" : "private"}, max-age=${YEAR}, immutable`
        : "no-cache",
    etag,
  };
  if (matches(q.ifNoneMatch, etag)) return new Response(null, { status: 304, headers });
  const doc = normalize(parse(view.version?.yaml ?? "").doc).doc;
  const svg = toSvg(doc, getCatalogue(), {
    icons: getIcons(),
    theme,
    layout: readSidecar(view.version?.layout),
    background: PANEL[theme],
  });
  return new Response(svg, { headers });
}
