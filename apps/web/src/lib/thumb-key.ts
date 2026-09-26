// The name of a list thumbnail, for caching it forever. A thumbnail is the engine's drawing of
// one version, so it changes when the YAML changes, when the layout sidecar changes (an autosave
// that only moved boxes keeps the content hash and rewrites the same row), when the catalogue
// changes (icons, names), and when the drawing code changes (THUMB_REV). The key covers all four,
// so a URL that carries it can be served as immutable.
import { createHash } from "node:crypto";
import { getCatalogue, getIcons } from "./catalogue";

/** Bump when the engine's drawing or the thumbnail's options (theme colours) change. */
export const THUMB_REV = "1";

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

export function thumbKey(contentHash: string, layout: unknown) {
  return createHash("sha256")
    .update(`${THUMB_REV}\n${catalogueStamp()}\n${contentHash}\n${JSON.stringify(layout ?? null)}`)
    .digest("hex")
    .slice(0, 32);
}
