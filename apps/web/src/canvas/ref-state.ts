// A node that references another design (`ref: { design: "owner/slug", version }`) is drawn with
// a link disc whose colour says where the reference stands. That is remote state: the summary
// route (GET /api/v1/designs/{owner}/{slug}/summary) answers it, once per design per canvas load.
// This module is the state machine and the cache, with the fetch injected so it is testable; the
// scene, the hover card, the preview and the Inspector all read it.

export type RefRelease = { version: number; id: string; publishedAt: string | null };

/** The summary route's answer (designs.ts `refSummary`), as JSON. */
export type RefSummary = {
  name: string;
  owner: string;
  slug: string;
  release: RefRelease | null;
  latest: number | null;
  releases: RefRelease[];
  counts: { nodes: number; edges: number; groups: number };
  thumb: string | null;
};

export type RefEntry =
  | { status: "pending" }
  | { status: "ok"; summary: RefSummary }
  | { status: "unreachable" };

/**
 * - `pending`: not answered yet.
 * - `current`: the pinned release is the latest, or the reference follows head of a released design.
 * - `newer`: pinned below the latest release.
 * - `unreleased`: the design has no release, or the pinned release is past the latest one.
 * - `unreachable`: private now, deleted, missing, or the platform did not answer.
 */
export type RefState = "pending" | "current" | "newer" | "unreleased" | "unreachable";

export type RefVersion = number | "head";

export function refState(entry: RefEntry | undefined, version: RefVersion): RefState {
  if (!entry || entry.status === "pending") return "pending";
  if (entry.status === "unreachable") return "unreachable";
  const latest = entry.summary.latest;
  if (latest === null) return "unreleased";
  if (version === "head") return "current";
  if (version > latest) return "unreleased";
  return version < latest ? "newer" : "current";
}

/** The disc's colour per state: the canvas's own tokens (app/globals.css). */
export const REF_COLOR: Record<RefState, string> = {
  pending: "var(--muted)",
  current: "var(--accent)",
  newer: "var(--warn)",
  unreleased: "var(--warn)",
  unreachable: "var(--muted)",
};

/** One line under the reference in the Inspector. */
export function refStatusText(entry: RefEntry | undefined, version: RefVersion): string {
  const state = refState(entry, version);
  if (state === "pending") return "Checking…";
  if (state === "unreachable" || entry?.status !== "ok") return "Not available";
  const latest = entry.summary.latest;
  if (version === "head")
    return latest === null ? "Follows latest · not released yet" : `Follows latest · v${latest}`;
  if (latest === null) return `Pinned at v${version} · not released yet`;
  if (version > latest) return `Pinned at v${version} · latest is v${latest}`;
  return version < latest
    ? `Pinned at v${version} · v${latest} available`
    : `Pinned at v${version} · latest`;
}

/** The release a reference points at, when the design has it (head: the current release). */
export function pinnedRelease(entry: RefEntry | undefined, version: RefVersion): RefRelease | null {
  if (entry?.status !== "ok") return null;
  const { releases, latest } = entry.summary;
  const want = version === "head" ? latest : version;
  return releases.find((r) => r.version === want) ?? null;
}

const seg = (s: string) => encodeURIComponent(s);

/**
 * The design page for a reference. The page takes `?v=<version id>`; the current release is the
 * page's own default, so it gets the plain address.
 */
export function refHref(
  owner: string,
  slug: string,
  entry: RefEntry | undefined,
  version: RefVersion,
): string {
  const base = `/d/${seg(owner)}/${seg(slug)}`;
  const r = pinnedRelease(entry, version);
  if (!r || entry?.status !== "ok" || r.version === entry.summary.latest) return base;
  return `${base}?v=${seg(r.id)}`;
}

/** The server render of a release (null: the current one) in a theme. */
export function renderHref(owner: string, slug: string, id: string | null, theme: string) {
  const v = id ? `&version=${seg(id)}` : "";
  return `/api/v1/designs/${seg(owner)}/${seg(slug)}/render?theme=${theme === "dark" ? "dark" : "light"}${v}`;
}

/** Resolves a design's summary, or null for a 404. Rejects when the platform did not answer. */
export type RefFetcher = (owner: string, slug: string) => Promise<RefSummary | null>;

export const fetchRefSummary: RefFetcher = async (owner, slug) => {
  const res = await fetch(`/api/v1/designs/${seg(owner)}/${seg(slug)}/summary`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`summary ${res.status}`);
  return (await res.json()) as RefSummary;
};

const keyOf = (owner: string, slug: string) => `${owner.toLowerCase()}/${slug.toLowerCase()}`;

/** One answer per `owner/slug`, asked for once; listeners hear every answer that lands. */
export class RefStore {
  private entries = new Map<string, RefEntry>();
  private inflight = new Map<string, Promise<RefEntry>>();
  private listeners = new Set<() => void>();

  constructor(private fetcher: RefFetcher) {}

  get(owner: string, slug: string): RefEntry | undefined {
    return this.entries.get(keyOf(owner, slug));
  }

  /** Ask for a design's summary unless it was already asked for; resolves with the entry. */
  ensure(owner: string, slug: string): Promise<RefEntry> {
    const key = keyOf(owner, slug);
    const have = this.entries.get(key);
    if (have && have.status !== "pending") return Promise.resolve(have);
    const going = this.inflight.get(key);
    if (going) return going;
    this.entries.set(key, { status: "pending" });
    const p = this.fetcher(owner, slug).then(
      (summary): RefEntry => (summary ? { status: "ok", summary } : { status: "unreachable" }),
      (): RefEntry => ({ status: "unreachable" }),
    );
    const done = p.then((entry) => {
      this.entries.set(key, entry);
      this.inflight.delete(key);
      for (const fn of this.listeners) fn();
      return entry;
    });
    this.inflight.set(key, done);
    return done;
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }
}
