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

/**
 * A new design is parked at `draft-<6 hex>` until its owner names it; when that name is already
 * taken, the service keeps it unique with a `-2`, `-3`, … counter, which is still a draft name.
 * One pattern, shared by the page that mints it and the publish that grows out of it, so the two
 * can never drift apart.
 */
export const DRAFT_SLUG = /^draft-[0-9a-f]{6}(-\d+)?$/;

export const isDraftSlug = (slug: string) => DRAFT_SLUG.test(slug.toLowerCase());

/**
 * The address a design wants when it is released: an untouched draft name gives way to the
 * title, anything the owner chose by hand is left alone. Pure, so the page can show the same
 * answer the service will reach — the service may still append `-2` to keep it unique.
 */
export const publishSlugFor = ({ slug, title }: { slug: string; title: string }) => {
  if (!isDraftSlug(slug)) return slug;
  const wanted = toTag(title);
  return wanted && wanted !== slug.toLowerCase() ? wanted : slug;
};

/** Mints one. Web Crypto, so the same function works on the server and in the browser. */
export const newDraftSlug = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(3));
  return `draft-${[...bytes].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
};
