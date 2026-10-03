// The name of a list thumbnail, for caching it forever. A thumbnail is the engine's drawing of
// one version, so it changes when the YAML changes, when the layout sidecar changes (an autosave
// that only moved boxes keeps the content hash and rewrites the same row), when the catalogue
// changes (icons, names), and when the drawing code changes (THUMB_REV). The key covers all four,
// so a URL that carries it can be served as immutable.
import { createHash } from "node:crypto";
import { getCatalogue, getIcons } from "./catalogue";
import { isBlankSidecar } from "./layout-sidecar";

/** Bump when the engine's drawing or the thumbnail's options (theme colours) change. */
export const THUMB_REV = "3";

let stamp: string | null = null;
/** One fingerprint of the catalogue and its icons per process: both are loaded once. */
function catalogueStamp() {
  if (stamp === null) {
    const { root: _root, ...cat } = getCatalogue();
    stamp = createHash("sha256")
      .update(JSON.stringify(cat))
      .update(JSON.stringify(getIcons()))
      .digest("hex");
  }
  return stamp;
}

// The sidecar's `badge` is the list row's corner mark, drawn beside the thumbnail and never in
// it, so choosing one leaves the key (and every cached thumbnail) as it was. A sidecar made only
// to carry a badge draws what no sidecar draws, so it keys like none.
function drawn(layout: unknown) {
  if (!layout || typeof layout !== "object" || !("badge" in layout)) return layout ?? null;
  if (isBlankSidecar(layout)) return null;
  const { badge: _badge, ...rest } = layout as Record<string, unknown>;
  return rest;
}

export function thumbKey(contentHash: string, layout: unknown) {
  return createHash("sha256")
    .update(`${THUMB_REV}\n${catalogueStamp()}\n${contentHash}\n${JSON.stringify(drawn(layout))}`)
    .digest("hex")
    .slice(0, 32);
}
