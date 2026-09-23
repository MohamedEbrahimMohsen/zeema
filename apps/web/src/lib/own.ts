// Catalogue and icon maps are plain objects keyed by ids that arrive from documents and URLs.
// A lookup reads own keys only, so `constructor` or `toString` is an unknown id rather than
// something inherited from Object.prototype.
// The canvas holds the catalogue untyped; `T` then falls back to `any` like the plain index did.
export function own<T = any>(o: Record<string, T> | null | undefined, k: string): T | undefined {
  return o != null && typeof k === "string" && Object.hasOwn(o, k) ? o[k] : undefined;
}
