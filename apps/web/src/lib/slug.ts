// One slug rule, shared. The service (designs.ts) normalises what it stores and the tag editor
// in the browser normalises what it shows, so a chip never reads back differently from what was
// saved. A second implementation of this would be the bug.

export const toSlug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || "design";

/** The same rule without the `design` fallback: an empty tag is dropped, never renamed. */
export const toTag = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
