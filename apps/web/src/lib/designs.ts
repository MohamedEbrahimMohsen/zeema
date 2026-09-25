// The design service: every read and write the pages and the API perform, with the
// authorization matrix (plan, section 13) applied here and nowhere else. Interfaces derive
// their own state ("can I edit this?") from the answers these functions give.
import { createHash } from "node:crypto";
import { and, desc, eq, gt, ilike, isNotNull, isNull, ne, or, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { getDb, schema } from "@/db";
import type { Design, DesignVersion } from "@/db/schema";
import { eventSalt } from "./boot";
import { brandMarkFor } from "./brand";
import { type Catalogue, getCatalogue } from "./catalogue";
import { escapeLike } from "./http-guards";
import { readSidecar } from "./layout-sidecar";
import { analyse } from "./lint";
import { countExport, countWrite } from "./metrics";
import { emit, notifyClone, notifyFollowersOfPublish } from "./notify";
import { own } from "./own";
import { type Sketch, sketchOf } from "./sketch";
import { publishSlugFor, toSlug, toTag } from "./slug";
import { actingAdmin, type SessionUser } from "./viewer";

export class ServiceError extends Error {
  constructor(
    public status: number,
    message: string,
    public findings?: unknown,
  ) {
    super(message);
  }
}

export const contentHash = (yaml: string) => createHash("sha256").update(yaml).digest("hex");
export { publishSlugFor, toSlug, toTag } from "./slug";

const MAX_YAML = 512 * 1024;
/** The README is prose, not a document: long enough for a real write-up, short of a book. */
export const MAX_README = 20_000;
export const MAX_TAGS = 10;

export type Viewer = SessionUser | null;

export type DesignView = {
  design: Design;
  owner: { username: string; displayName: string | null; avatarUrl: string | null } | null;
  /** What this viewer works with: the head for a writer, the release for everyone else. */
  version: DesignVersion | null;
  /** The release, when the design has one. Null for a design that was never published. */
  published: { id: string; contentHash: string; createdAt: Date; publishedAt: Date | null } | null;
  /** The head differs from the release (writers only; always false for readers). */
  unpublished: boolean;
  /**
   * How many versions discarding the draft would delete: every unreleased version saved after
   * the release. Zero for readers and for a design whose head is its release. The confirmation
   * says the number out loud, because discarding is not undoable any more.
   */
  draftVersionCount: number;
  stats: { viewCount: number; cloneCount: number; exportCount: number };
  can: { read: boolean; write: boolean; clone: boolean; publish: boolean };
};

export type DesignSummary = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  visibility: "public" | "private";
  origin: "authored" | "imported" | "reference";
  updatedAt: Date;
  owner: { username: string } | null;
  /** Head differs from release: the card shows a draft marker to its writer. */
  unpublished: boolean;
  stats: { viewCount: number; cloneCount: number; exportCount: number };
  providers: string[];
  nodeCount: number;
  /** Edges and open findings of the shown version, for the browse listing's columns. */
  edgeCount: number;
  findingCount: number;
  /** Brand mark inner-SVG for a well-known product, else null. */
  brand: string | null;
  /** The engine's layout of the current version, for the card thumbnail. */
  sketch: Sketch | null;
};

export const ownerSegment = (owner: { username: string } | null) => owner?.username ?? "zeema";

// ---------------------------------------------------------------- reads

// The authorization matrix. An acting admin reads every design and writes the curated ones
// (owner-less reference and imported designs); members' own designs stay theirs alone.
function canRead(d: Design, viewer: Viewer) {
  if (d.deletedAt) return false;
  if (d.visibility === "public") return true;
  if (actingAdmin(viewer)) return true;
  return Boolean(viewer && d.ownerId === viewer.id);
}
function canWrite(d: Design, viewer: Viewer) {
  if (!viewer || d.deletedAt) return false;
  if (d.ownerId) return d.ownerId === viewer.id && d.origin === "authored";
  return actingAdmin(viewer);
}

async function resolveDesign(owner: string, slug: string) {
  const db = await getDb();
  if (owner === "zeema") {
    const rows = await db
      .select()
      .from(schema.designs)
      .where(
        and(
          isNull(schema.designs.ownerId),
          eq(sql`lower(${schema.designs.slug})`, slug.toLowerCase()),
        ),
      )
      .limit(1);
    return { design: rows[0] ?? null, owner: null };
  }
  const rows = await db
    .select({ design: schema.designs, owner: schema.users })
    .from(schema.designs)
    .innerJoin(schema.users, eq(schema.users.id, schema.designs.ownerId))
    .where(
      and(
        eq(sql`lower(${schema.users.username})`, owner.toLowerCase()),
        eq(sql`lower(${schema.designs.slug})`, slug.toLowerCase()),
      ),
    )
    .limit(1);
  return rows[0] ?? { design: null, owner: null };
}

/** An address the design used to answer to, for the redirect. Null if this is its current one. */
export async function resolveAlias(owner: string, slug: string): Promise<string | null> {
  const db = await getDb();
  const rows = await db
    .select({ design: schema.designs, username: schema.users.username })
    .from(schema.designSlugs)
    .innerJoin(schema.designs, eq(schema.designs.id, schema.designSlugs.designId))
    .leftJoin(schema.users, eq(schema.users.id, schema.designs.ownerId))
    .where(
      and(
        eq(sql`lower(coalesce(${schema.users.username}, 'zeema'))`, owner.toLowerCase()),
        eq(sql`lower(${schema.designSlugs.slug})`, slug.toLowerCase()),
      ),
    )
    .limit(1);
  const hit = rows[0];
  // The row points at the design, not at the next name, so however many renames happened the
  // current address is one read away and there is no chain to follow.
  if (!hit || hit.design.deletedAt) return null;
  if (hit.design.slug.toLowerCase() === slug.toLowerCase()) return null;
  return hit.design.slug;
}

/**
 * The versions a discard throws away: everything saved after the release that was never released
 * itself. The release and every version before it are not touched, and neither is a broken twin.
 * One predicate serves both the count the page shows and the delete the service performs, so the
 * number in the confirmation is the number of rows that go.
 *
 * Every comparison goes through drizzle's operators rather than a raw `sql` template: an operator
 * encodes the value with the column's own mapper, so the timestamp reaches the driver as an ISO
 * string. A Date interpolated into `sql` is bound raw, which PGlite accepts and Postgres never
 * sees, because the query cache hashes the parameters first and throws on a Date.
 */
export function abandonedSince(designId: string, release: { id: string; createdAt: Date }) {
  return and(
    eq(schema.designVersions.designId, designId),
    eq(schema.designVersions.broken, false),
    isNull(schema.designVersions.publishedAt),
    ne(schema.designVersions.id, release.id),
    gt(schema.designVersions.createdAt, release.createdAt),
  );
}

/** A design by address, or a 404 for anything the viewer may not see (private designs never 403). */
export async function getDesign(
  owner: string,
  slug: string,
  viewer: Viewer,
  opts: { version?: string } = {},
): Promise<DesignView> {
  const db = await getDb();
  const { design, owner: ownerUser } = await resolveDesign(owner, slug);
  if (!design || !canRead(design, viewer)) throw new ServiceError(404, "design not found");
  const write = canWrite(design, viewer);
  const versionById = async (id: string | null) => {
    if (!id) return null;
    const rows = await db
      .select()
      .from(schema.designVersions)
      .where(and(eq(schema.designVersions.designId, design.id), eq(schema.designVersions.id, id)))
      .limit(1);
    return rows[0] ?? null;
  };
  let version: DesignVersion | null = null;
  if (opts.version) {
    version = await versionById(opts.version);
    // Readers may open released versions only; the draft history is the writer's.
    if (!version || (!write && !version.publishedAt))
      throw new ServiceError(404, "version not found");
  } else version = await versionById(write ? design.currentVersionId : design.publishedVersionId);
  const publishedRow =
    design.publishedVersionId === version?.id
      ? version
      : await versionById(design.publishedVersionId);
  const published = publishedRow
    ? {
        id: publishedRow.id,
        contentHash: publishedRow.contentHash,
        createdAt: publishedRow.createdAt,
        publishedAt: publishedRow.publishedAt,
      }
    : null;
  // Counted whenever there is a release to count against, not only while the head has moved on:
  // a design discarded before this deletion existed still carries abandoned rows with its head
  // already back on the release, and the count is what makes them findable and removable.
  const draftVersionCount =
    write && publishedRow
      ? (
          await db
            .select({ id: schema.designVersions.id })
            .from(schema.designVersions)
            .where(abandonedSince(design.id, publishedRow))
        ).length
      : 0;
  const statsRows = await db
    .select()
    .from(schema.designStats)
    .where(eq(schema.designStats.designId, design.id))
    .limit(1);
  const s = statsRows[0];
  return {
    design,
    owner: ownerUser
      ? {
          username: ownerUser.username,
          displayName: ownerUser.displayName,
          avatarUrl: ownerUser.avatarUrl,
        }
      : null,
    version,
    published,
    unpublished: write && design.currentVersionId !== design.publishedVersionId,
    draftVersionCount,
    stats: {
      viewCount: s?.viewCount ?? 0,
      cloneCount: s?.cloneCount ?? 0,
      exportCount: s?.exportCount ?? 0,
    },
    can: { read: true, write, clone: Boolean(viewer), publish: write },
  };
}

/** The broken twin of a curated design, when it has one. */
export async function getBrokenVersion(designId: string) {
  const db = await getDb();
  const rows = await db
    .select()
    .from(schema.designVersions)
    .where(
      and(eq(schema.designVersions.designId, designId), eq(schema.designVersions.broken, true)),
    )
    .limit(1);
  return rows[0] ?? null;
}

/** History. A writer sees every save; a reader sees the releases only. */
export async function listVersions(view: DesignView) {
  const db = await getDb();
  const conds = [
    eq(schema.designVersions.designId, view.design.id),
    eq(schema.designVersions.broken, false),
  ];
  if (!view.can.write) conds.push(isNotNull(schema.designVersions.publishedAt));
  return db
    .select()
    .from(schema.designVersions)
    .where(and(...conds))
    .orderBy(desc(schema.designVersions.createdAt))
    .limit(100);
}

export type ListOptions = {
  q?: string;
  provider?: string;
  kind?: string;
  /** One of the author's own words, matched against the design's tag list. */
  tag?: string;
  owner?: string;
  /** Curation tier: reference and imported are the seeded designs, authored are people's own. */
  origin?: "authored" | "imported" | "reference";
  /** `published`: newest release first (profiles). */
  sort?: "updated" | "created" | "clones" | "exports" | "published";
  /** Only designs with a release (the profile's public list). */
  released?: boolean;
  /** With scope `mine`: only private designs and designs never released (the profile's drafts). */
  drafts?: boolean;
  page?: number;
  pageSize?: number;
  /** `all` (every design, private included) is available to an acting admin only. */
  scope?: "public" | "mine" | "all";
  /** With scope `all`: restrict to one visibility. */
  visibility?: "public" | "private";
};

// Edges and findings are read off the version the listing shows rather than stored on the row,
// so a catalogue change is reflected without rewriting every design. Only errors and warnings
// count: info findings are suggestions, and a row that flagged them would never read clean.
function countsOf(yaml: string | null, cat: Catalogue) {
  if (!yaml) return { edgeCount: 0, findingCount: 0 };
  const { doc, findings } = analyse(yaml, cat);
  return {
    edgeCount: doc?.edges.length ?? 0,
    findingCount: findings.filter((f) => f.severity !== "info").length,
  };
}

/** Browse. Visibility is inside the query, never filtered afterwards. */
export async function listDesigns(
  viewer: Viewer,
  opts: ListOptions = {},
): Promise<{ items: DesignSummary[]; total: number; page: number; pageSize: number }> {
  const db = await getDb();
  const whole = (v: number | undefined, fallback: number) =>
    typeof v === "number" && Number.isFinite(v) ? Math.trunc(v) : fallback;
  const page = Math.max(1, whole(opts.page, 1));
  const pageSize = Math.min(100, Math.max(1, whole(opts.pageSize, 24)));
  const conds = [isNull(schema.designs.deletedAt)];
  if (opts.scope === "mine") {
    if (!viewer) return { items: [], total: 0, page, pageSize };
    conds.push(eq(schema.designs.ownerId, viewer.id));
  } else if (opts.scope === "all" && actingAdmin(viewer)) {
    if (opts.visibility) conds.push(eq(schema.designs.visibility, opts.visibility));
  } else conds.push(eq(schema.designs.visibility, "public"));
  // Cards draw the release for the public; the writer's own listing draws the head.
  const shownVersion =
    opts.scope === "mine" || (opts.scope === "all" && actingAdmin(viewer))
      ? schema.designs.currentVersionId
      : schema.designs.publishedVersionId;
  if (opts.owner) {
    if (opts.owner === "zeema") conds.push(isNull(schema.designs.ownerId));
    else
      conds.push(
        sql`${schema.designs.ownerId} in (select id from users where lower(username) = ${opts.owner.toLowerCase()})`,
      );
  }
  if (opts.q) {
    const terms = opts.q.split(/\s+/).filter(Boolean).slice(0, 8);
    // A term matches itself: `%` and `_` typed into the box are text, not wildcards.
    for (const t of terms.map(escapeLike))
      conds.push(
        or(
          ilike(schema.designs.title, `%${t}%`),
          ilike(schema.designs.summary, `%${t}%`),
          ilike(schema.designs.searchText, `%${t}%`),
        )!,
      );
  }
  if (opts.origin) conds.push(eq(schema.designs.origin, opts.origin));
  if (opts.released) conds.push(isNotNull(schema.designs.publishedVersionId));
  if (opts.drafts)
    conds.push(
      or(eq(schema.designs.visibility, "private"), isNull(schema.designs.publishedVersionId))!,
    );
  if (opts.provider)
    conds.push(ilike(schema.designs.searchText, `%provider:${escapeLike(opts.provider)}%`));
  if (opts.kind) conds.push(ilike(schema.designs.searchText, `%kind:${escapeLike(opts.kind)}%`));
  // Containment rather than a text match: `tags @> '["db"]'` finds the tag "db" and never the
  // design tagged "dbt", which `like '%db%'` would have handed back.
  if (opts.tag)
    conds.push(sql`${schema.designs.tags} @> ${JSON.stringify([toTag(opts.tag)])}::jsonb`);
  const where = and(...conds);
  const order =
    opts.sort === "published"
      ? desc(
          sql`coalesce(${schema.designVersions.publishedAt}, ${schema.designs.publishedAt}, ${schema.designs.updatedAt})`,
        )
      : opts.sort === "clones"
        ? desc(sql`coalesce(${schema.designStats.cloneCount}, 0)`)
        : opts.sort === "exports"
          ? desc(sql`coalesce(${schema.designStats.exportCount}, 0)`)
          : opts.sort === "created"
            ? desc(schema.designs.createdAt)
            : desc(schema.designs.updatedAt);
  const rows = await db
    .select({
      design: schema.designs,
      ownerName: schema.users.username,
      stats: schema.designStats,
      yaml: schema.designVersions.yaml,
    })
    .from(schema.designs)
    .leftJoin(schema.users, eq(schema.users.id, schema.designs.ownerId))
    .leftJoin(schema.designStats, eq(schema.designStats.designId, schema.designs.id))
    .leftJoin(schema.designVersions, eq(schema.designVersions.id, shownVersion))
    .where(where)
    .orderBy(order, desc(schema.designs.id))
    .limit(pageSize)
    .offset((page - 1) * pageSize);
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.designs)
    .where(where);
  const cat = getCatalogue();
  return {
    items: rows.map(({ design, ownerName, stats, yaml }) => ({
      id: design.id,
      slug: design.slug,
      title: design.title,
      summary: design.summary,
      visibility: design.visibility,
      origin: design.origin,
      updatedAt: design.updatedAt,
      owner: ownerName ? { username: ownerName } : null,
      // Only the writer is told there is unreleased work; to a reader the release is the design.
      unpublished:
        design.currentVersionId !== design.publishedVersionId && canWrite(design, viewer),
      stats: {
        viewCount: stats?.viewCount ?? 0,
        cloneCount: stats?.cloneCount ?? 0,
        exportCount: stats?.exportCount ?? 0,
      },
      providers: [
        ...new Set((design.searchText.match(/provider:([a-z]+)/g) ?? []).map((m) => m.slice(9))),
      ],
      nodeCount: Number(/nodes:(\d+)/.exec(design.searchText)?.[1] ?? 0),
      ...countsOf(yaml, cat),
      brand: brandMarkFor(design.slug),
      sketch: yaml ? sketchOf(yaml, cat) : null,
    })),
    total: Number(count),
    page,
    pageSize,
  };
}

/** The owner handles the search box offers after `@`. `zeema` stands for the curated designs,
 *  which have no owner row; the rest are people with at least one design the viewer can see. */
export async function listOwners(viewer: Viewer): Promise<string[]> {
  const db = await getDb();
  const rows = await db
    .select({ username: schema.users.username })
    .from(schema.designs)
    .innerJoin(schema.users, eq(schema.users.id, schema.designs.ownerId))
    .where(
      and(
        isNull(schema.designs.deletedAt),
        // A closed account has no profile page (getUserProfile hides it), so offering its name
        // as a filter would offer a link to a 404.
        isNull(schema.users.deletedAt),
        actingAdmin(viewer)
          ? undefined
          : viewer
            ? or(eq(schema.designs.visibility, "public"), eq(schema.designs.ownerId, viewer.id))
            : eq(schema.designs.visibility, "public"),
      ),
    )
    .groupBy(schema.users.username)
    .orderBy(schema.users.username)
    .limit(50);
  return ["zeema", ...rows.map((r) => r.username)];
}

/** The tags already in use, commonest first, to offer while someone types a new one. A tag is
 *  only suggested from designs the viewer may see, so a private design never leaks a word. */
export async function listTags(viewer: Viewer): Promise<string[]> {
  const db = await getDb();
  const rows = await db
    .select({ tags: schema.designs.tags })
    .from(schema.designs)
    .where(
      and(
        isNull(schema.designs.deletedAt),
        actingAdmin(viewer)
          ? undefined
          : viewer
            ? or(eq(schema.designs.visibility, "public"), eq(schema.designs.ownerId, viewer.id))
            : eq(schema.designs.visibility, "public"),
      ),
    )
    .limit(2000);
  const uses = new Map<string, number>();
  for (const r of rows) for (const t of r.tags ?? []) uses.set(t, (uses.get(t) ?? 0) + 1);
  return [...uses.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 50)
    .map(([tag]) => tag);
}

// ---------------------------------------------------------------- writes

function searchTextFor(yaml: string, cat: Catalogue) {
  const { doc } = analyse(yaml, cat);
  if (!doc) return "";
  const parts = new Set<string>();
  for (const n of doc.nodes) {
    const c = own(cat.components, n.component);
    parts.add(`component:${n.component}`);
    if (c) {
      parts.add(`provider:${c.provider}`);
      parts.add(`kind:${c.kind}`);
      parts.add(own(cat.locale.components, n.component)?.name ?? "");
    }
    if (n.label) parts.add(String(n.label));
  }
  return `${[...parts].join(" ")} nodes:${doc.nodes.length}`;
}

/** Ceilings on the layout sidecar as stored: key counts follow the document's own limits. */
const MAX_LAYOUT_BYTES = 256 * 1024;
const MAX_LAYOUT_NODES = 2_000;
const MAX_LAYOUT_EDGES = 5_000;

/**
 * The sidecar as it will be stored: normalised through the same reader the canvas uses (unknown
 * keys gone, notes capped in count and length), then bounded. Refused rather than trimmed when
 * it is still too large, so a client never has part of its drawing silently dropped.
 */
export function normaliseLayout(raw: unknown) {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== "object" || Array.isArray(raw))
    throw new ServiceError(400, "layout must be an object");
  const s = readSidecar(raw);
  if (
    Object.keys(s.nodes).length > MAX_LAYOUT_NODES ||
    Object.keys(s.edges).length > MAX_LAYOUT_EDGES ||
    Object.keys(s.ports ?? {}).length > MAX_LAYOUT_EDGES
  )
    throw new ServiceError(413, "layout too large");
  if (Buffer.byteLength(JSON.stringify(s), "utf8") > MAX_LAYOUT_BYTES)
    throw new ServiceError(413, "layout too large");
  return s;
}

function validateOrThrow(yaml: string, cat: Catalogue) {
  if (typeof yaml !== "string") throw new ServiceError(400, "yaml must be text");
  if (Buffer.byteLength(yaml, "utf8") > MAX_YAML) throw new ServiceError(413, "design too large");
  const { doc, findings } = analyse(yaml, cat);
  const blocking = findings.filter((f) => f.blocking);
  if (!doc || blocking.length)
    throw new ServiceError(422, "design is not structurally valid", blocking);
  if (doc.nodes.length > 1000 || doc.edges.length > 5000)
    throw new ServiceError(413, "design too large");
  return doc;
}

// Owner-less rows are the curated designs, so "this owner" always means IS NULL for them.
const ownerIs = (col: AnyPgColumn, ownerId: string | null) =>
  ownerId ? eq(col, ownerId) : isNull(col);

/** Whether this owner may put a design at this address. `self` is a design reclaiming its own. */
async function slugTaken(ownerId: string | null, slug: string, self?: string) {
  const db = await getDb();
  const live = await db
    .select({ id: schema.designs.id })
    .from(schema.designs)
    .where(
      and(
        ownerIs(schema.designs.ownerId, ownerId),
        eq(sql`lower(${schema.designs.slug})`, slug),
        isNull(schema.designs.deletedAt),
      ),
    )
    .limit(1);
  if (live[0] && live[0].id !== self) return true;
  const held = await db
    .select({ designId: schema.designSlugs.designId })
    .from(schema.designSlugs)
    .where(
      and(
        ownerIs(schema.designSlugs.ownerId, ownerId),
        eq(sql`lower(${schema.designSlugs.slug})`, slug),
      ),
    )
    .limit(1);
  return Boolean(held[0] && held[0].designId !== self);
}

async function uniqueSlug(ownerId: string | null, wanted: string) {
  const base = toSlug(wanted);
  for (let n = 0; n < 100; n++) {
    const candidate = n ? `${base}-${n + 1}` : base;
    if (!(await slugTaken(ownerId, candidate))) return candidate;
  }
  throw new ServiceError(409, "no free slug");
}

/** Reserves an address for a design. Idempotent: publishing twice reserves once. */
async function reserveSlug(ownerId: string | null, slug: string, designId: string) {
  const db = await getDb();
  if (await slugTaken(ownerId, slug, designId)) return;
  const held = await db
    .select({ id: schema.designSlugs.id })
    .from(schema.designSlugs)
    .where(
      and(
        ownerIs(schema.designSlugs.ownerId, ownerId),
        eq(sql`lower(${schema.designSlugs.slug})`, slug.toLowerCase()),
      ),
    )
    .limit(1);
  if (held[0]) return;
  await db.insert(schema.designSlugs).values({ ownerId, slug, designId });
}

export type CreateInput = {
  title: string;
  slug?: string;
  summary?: string;
  visibility?: "public" | "private";
  yaml: string;
  layout?: unknown;
  message?: string;
  sourceDesignId?: string;
  origin?: "authored" | "imported" | "reference";
  broken?: boolean;
};

export async function createDesign(
  viewer: Viewer,
  input: CreateInput,
  opts: { curated?: boolean } = {},
) {
  const cat = getCatalogue();
  const db = await getDb();
  if (!opts.curated && !viewer) throw new ServiceError(401, "sign in to create a design");
  if (!input.title || input.title.length > 120)
    throw new ServiceError(400, "title is required (at most 120 characters)");
  validateOrThrow(input.yaml, cat);
  const layout = normaliseLayout(input.layout);
  const ownerId = opts.curated ? null : viewer!.id;
  const slug = await uniqueSlug(ownerId, input.slug ?? input.title);
  const visibility = opts.curated ? "public" : (input.visibility ?? "private");
  const [design] = await db
    .insert(schema.designs)
    .values({
      ownerId,
      slug,
      title: input.title,
      summary: input.summary ?? null,
      visibility,
      origin: opts.curated ? (input.origin ?? "reference") : "authored",
      sourceDesignId: input.sourceDesignId ?? null,
      searchText: searchTextFor(input.yaml, cat),
      publishedAt: visibility === "public" ? new Date() : null,
    })
    .returning();
  const [version] = await db
    .insert(schema.designVersions)
    .values({
      designId: design.id,
      yaml: input.yaml,
      layout,
      contentHash: contentHash(input.yaml),
      authorId: viewer?.id ?? null,
      message: input.message ?? "created",
    })
    .returning();
  // A design born public (curated seeds, explicit public creates) is released at once.
  const publishedVersionId = visibility === "public" ? version.id : null;
  if (publishedVersionId)
    await db
      .update(schema.designVersions)
      .set({ publishedAt: new Date() })
      .where(eq(schema.designVersions.id, version.id));
  await db
    .update(schema.designs)
    .set({ currentVersionId: version.id, publishedVersionId })
    .where(eq(schema.designs.id, design.id));
  await db.insert(schema.designStats).values({ designId: design.id });
  countWrite("create");
  return { design: { ...design, currentVersionId: version.id, publishedVersionId }, version };
}

export async function addBrokenVersion(designId: string, yaml: string) {
  const db = await getDb();
  const [v] = await db
    .insert(schema.designVersions)
    .values({
      designId,
      yaml,
      contentHash: contentHash(yaml),
      broken: true,
      message: "broken twin",
    })
    .returning();
  return v;
}

export type SaveInput = { yaml: string; layout?: unknown; message?: string; ifMatch?: string };

/** Saves by the same author inside this window fold into the head instead of stacking up. */
const COALESCE_MS = 10 * 60_000;

/**
 * A save. Requires the last-seen content hash (conflicts are refused, never merged). The head
 * moves; the release does not, so readers keep the published version until publishDesign.
 * Autosave fires at every pause, so an unreleased head by the same author within ten minutes
 * is rewritten in place rather than becoming another row: history keeps working sessions,
 * not keystrokes.
 */
export async function saveVersion(owner: string, slug: string, viewer: Viewer, input: SaveInput) {
  const cat = getCatalogue();
  const db = await getDb();
  const view = await getDesign(owner, slug, viewer);
  if (!view.can.write)
    throw new ServiceError(
      view.design.visibility === "public" ? 403 : 404,
      "you cannot edit this design",
    );
  if (!input.ifMatch) throw new ServiceError(428, "If-Match content hash is required");
  if (view.version && input.ifMatch !== view.version.contentHash)
    throw new ServiceError(409, "the design changed since you loaded it", {
      currentHash: view.version.contentHash,
    });
  validateOrThrow(input.yaml, cat);
  const layout = normaliseLayout(input.layout);
  const hash = contentHash(input.yaml);
  if (
    view.version &&
    hash === view.version.contentHash &&
    JSON.stringify(layout) === JSON.stringify(view.version.layout ?? null)
  )
    return { design: view.design, version: view.version, unchanged: true };
  const head = view.version;
  const foldable =
    head &&
    !head.publishedAt &&
    head.authorId === viewer!.id &&
    !input.message &&
    Date.now() - head.createdAt.getTime() < COALESCE_MS;
  let version: DesignVersion;
  if (foldable) {
    [version] = await db
      .update(schema.designVersions)
      .set({ yaml: input.yaml, layout, contentHash: hash })
      .where(eq(schema.designVersions.id, head.id))
      .returning();
  } else {
    [version] = await db
      .insert(schema.designVersions)
      .values({
        designId: view.design.id,
        yaml: input.yaml,
        layout,
        contentHash: hash,
        authorId: viewer!.id,
        message: input.message ?? null,
      })
      .returning();
  }
  const [design] = await db
    .update(schema.designs)
    .set({
      currentVersionId: version.id,
      updatedAt: new Date(),
      searchText: searchTextFor(input.yaml, cat),
    })
    .where(eq(schema.designs.id, view.design.id))
    .returning();
  countWrite("save");
  return { design, version, unchanged: false };
}

/**
 * Release the head: readers now see it and it enters the public history. A private design can
 * be published too; its release shows the moment the design is made public.
 */
export async function publishDesign(
  owner: string,
  slug: string,
  viewer: Viewer,
  input: { note?: string } = {},
) {
  const db = await getDb();
  const view = await getDesign(owner, slug, viewer);
  if (!view.can.publish) throw new ServiceError(403, "you cannot publish this design");
  const head = view.version;
  if (!head) throw new ServiceError(400, "nothing to publish");
  if (view.design.publishedVersionId === head.id)
    return { design: view.design, version: head, unchanged: true };
  const now = new Date();
  const [version] = await db
    .update(schema.designVersions)
    .set({ publishedAt: now, message: input.note?.slice(0, 200) || head.message })
    .where(eq(schema.designVersions.id, head.id))
    .returning();
  // A draft still sitting at its minted `draft-xxxxxx` address grows into its title as it is
  // released, so the first public link reads like the design. An address the owner chose by hand
  // is never touched, and a title that slugifies to nothing leaves the draft name standing.
  const wanted = publishSlugFor({ slug: view.design.slug, title: view.design.title });
  const slugNow =
    wanted === view.design.slug ? view.design.slug : await uniqueSlug(view.design.ownerId, wanted);
  const [design] = await db
    .update(schema.designs)
    .set({
      publishedVersionId: head.id,
      publishedAt: view.design.publishedAt ?? now,
      slug: slugNow,
      updatedAt: now,
    })
    .where(eq(schema.designs.id, view.design.id))
    .returning();
  // A released address is public property from here on: reserved against every other design,
  // including this owner's own later ones, so a link out in the world never changes meaning.
  // When publishing moved the design, the draft address is reserved too and keeps resolving
  // through `resolveAlias`, exactly as a rename does — a link shared before the release still
  // lands on the design.
  if (slugNow !== view.design.slug)
    await reserveSlug(view.design.ownerId, view.design.slug, view.design.id);
  await reserveSlug(view.design.ownerId, slugNow, view.design.id);
  countWrite("publish");
  // Followers hear about a release they can read. A private design's release waits until the
  // design is made public (patchDesign).
  if (design.visibility === "public") await emit("publish", () => notifyFollowersOfPublish(design));
  return { design, version, unchanged: false };
}

/**
 * Throw the draft away and make the release the head again.
 *
 * The head moves back to the release first, and then the abandoned work is deleted: every
 * unreleased version saved after the release goes, rows and layout sidecars with them (the
 * sidecar lives on the version row, so there is nothing else to clean up, and no other table
 * points at a version id — events and stats hang off the design). The release and everything
 * before it stay, so the history a reader can see is untouched. This is not undoable, which is
 * why the confirmation says how many versions it is about to take.
 */
export async function discardDraft(owner: string, slug: string, viewer: Viewer) {
  const db = await getDb();
  const view = await getDesign(owner, slug, viewer);
  if (!view.can.write) throw new ServiceError(403, "you cannot edit this design");
  const release = view.design.publishedVersionId;
  if (!release) throw new ServiceError(409, "this design has never been published");
  const moved = view.design.currentVersionId !== release;
  // Nothing to do only when both are true: the head already is the release and no abandoned
  // version is left behind it. A design discarded under the older behaviour is the second case
  // on its own, and this is the only way its rows ever go.
  if (!moved && view.draftVersionCount === 0)
    throw new ServiceError(409, "the draft is the release; there is nothing to discard");
  if (moved)
    await db
      .update(schema.designs)
      .set({ currentVersionId: release, updatedAt: new Date() })
      .where(eq(schema.designs.id, view.design.id));
  // The pointer moves first: if the delete failed halfway, the design is still on its release
  // rather than pointing at a row that is no longer there.
  const deleted = view.published
    ? await db
        .delete(schema.designVersions)
        .where(abandonedSince(view.design.id, view.published))
        .returning()
    : [];
  countWrite("discard");
  return { ...(await getDesign(owner, slug, viewer)), deletedVersionCount: deleted.length };
}

export type PatchInput = {
  title?: string;
  slug?: string;
  summary?: string;
  readme?: string | null;
  visibility?: "public" | "private";
  tags?: string[];
};

export async function patchDesign(owner: string, slug: string, viewer: Viewer, input: PatchInput) {
  const db = await getDb();
  const view = await getDesign(owner, slug, viewer);
  if (!view.can.write) throw new ServiceError(403, "you cannot edit this design");
  const set: Partial<Design> = { updatedAt: new Date() };
  if (input.title !== undefined) {
    if (!input.title || input.title.length > 120)
      throw new ServiceError(400, "title must be 1 to 120 characters");
    set.title = input.title;
  }
  // Renaming is allowed, the way it is on GitHub: the old address is reserved and redirects, so
  // links already in the world keep working and nothing else can ever take that name.
  if (input.slug !== undefined) {
    const wanted = toSlug(input.slug);
    if (!wanted) throw new ServiceError(400, "name must contain a letter or number");
    if (wanted !== view.design.slug.toLowerCase()) {
      if (await slugTaken(view.design.ownerId, wanted, view.design.id))
        throw new ServiceError(409, "that name is taken, or was used by a published design");
      if (view.design.publishedAt)
        await reserveSlug(view.design.ownerId, view.design.slug, view.design.id);
      set.slug = wanted;
    }
  }
  if (input.summary !== undefined) set.summary = input.summary.slice(0, 280) || null;
  // The README is refused rather than truncated: silently losing the end of someone's writing is
  // worse than making them shorten it themselves.
  if (input.readme !== undefined) {
    const text = input.readme ?? "";
    if (typeof text !== "string") throw new ServiceError(400, "readme must be text");
    if (text.length > MAX_README)
      throw new ServiceError(
        422,
        `readme is ${text.length} characters; the limit is ${MAX_README}`,
      );
    set.readme = text.trim() ? text : null;
  }
  if (input.visibility !== undefined) {
    if (!["public", "private"].includes(input.visibility))
      throw new ServiceError(400, "visibility must be public or private");
    set.visibility = input.visibility;
    if (input.visibility === "public" && !view.design.publishedAt) set.publishedAt = new Date();
    if (input.visibility === "public")
      await reserveSlug(view.design.ownerId, set.slug ?? view.design.slug, view.design.id);
    // Going public with nothing released yet releases the head, so the page is not empty.
    if (input.visibility === "public" && !view.design.publishedVersionId && view.version) {
      set.publishedVersionId = view.version.id;
      await db
        .update(schema.designVersions)
        .set({ publishedAt: new Date() })
        .where(eq(schema.designVersions.id, view.version.id));
    }
  }
  if (input.tags !== undefined) {
    if (!Array.isArray(input.tags)) throw new ServiceError(400, "tags must be a list of words");
    set.tags = [...new Set(input.tags.map((t) => toTag(String(t))).filter(Boolean))].slice(
      0,
      MAX_TAGS,
    );
  }
  const [design] = await db
    .update(schema.designs)
    .set(set)
    .where(eq(schema.designs.id, view.design.id))
    .returning();
  // Made public with a release: to a follower that is the moment it was published.
  if (
    view.design.visibility !== "public" &&
    design.visibility === "public" &&
    design.publishedVersionId
  )
    await emit("publish", () => notifyFollowersOfPublish(design));
  return design;
}

/** An author may always remove their own work. What that costs depends on who could have seen it.
 *
 *  A design that was never published has no address anyone could have linked to, so it is removed
 *  outright and its name goes back to its owner. One that was published leaves a tombstone: the
 *  row stays, marked deleted, and its reserved address keeps answering, because links to it exist
 *  and pointing them at somebody else's design later would be worse than a dead end.
 *
 *  Clones are unaffected either way. A clone copies the YAML when it is made and `sourceDesignId`
 *  carries no foreign key, so deleting a source orphans a pointer and breaks nothing.
 */
export async function deleteDesign(owner: string, slug: string, viewer: Viewer) {
  const db = await getDb();
  const view = await getDesign(owner, slug, viewer);
  if (!view.can.write) throw new ServiceError(403, "you cannot delete this design");
  const wasPublic = Boolean(view.design.publishedAt);
  if (wasPublic) {
    await db
      .update(schema.designs)
      .set({ deletedAt: new Date(), visibility: "private" })
      .where(eq(schema.designs.id, view.design.id));
  } else {
    await db
      .delete(schema.designVersions)
      .where(eq(schema.designVersions.designId, view.design.id));
    await db.delete(schema.designEvents).where(eq(schema.designEvents.designId, view.design.id));
    await db.delete(schema.designStats).where(eq(schema.designStats.designId, view.design.id));
    await db.delete(schema.designSlugs).where(eq(schema.designSlugs.designId, view.design.id));
    await db.delete(schema.designs).where(eq(schema.designs.id, view.design.id));
  }
  countWrite("delete");
  return { tombstoned: wasPublic };
}

export type Tombstone = { title: string; owner: string; slug: string; deletedAt: Date };

/** What used to be at an address: a design its author removed after publishing it. */
export async function getTombstone(owner: string, slug: string): Promise<Tombstone | null> {
  const db = await getDb();
  const rows = await db
    .select({ design: schema.designs, username: schema.users.username })
    .from(schema.designs)
    .leftJoin(schema.users, eq(schema.users.id, schema.designs.ownerId))
    .where(
      and(
        eq(sql`lower(coalesce(${schema.users.username}, 'zeema'))`, owner.toLowerCase()),
        eq(sql`lower(${schema.designs.slug})`, slug.toLowerCase()),
        isNotNull(schema.designs.deletedAt),
        isNotNull(schema.designs.publishedAt),
      ),
    )
    .limit(1);
  const hit = rows[0];
  if (!hit?.design.deletedAt) return null;
  return {
    title: hit.design.title,
    owner: hit.username ?? "zeema",
    slug: hit.design.slug,
    deletedAt: hit.design.deletedAt,
  };
}

export type CloneInput = { slug?: string; title?: string; yaml?: string; layout?: unknown };

/** Clone into the caller's account, with what is on screen if the client sends it. Counts once. */
export async function cloneDesign(
  owner: string,
  slug: string,
  viewer: Viewer,
  input: CloneInput = {},
) {
  const _db = await getDb();
  if (!viewer) throw new ServiceError(401, "sign in to clone a design");
  const view = await getDesign(owner, slug, viewer);
  const yaml = input.yaml ?? view.version?.yaml;
  if (!yaml) throw new ServiceError(400, "nothing to clone");
  // The clone keeps the name it was cloned from. Slugs are unique per owner, not globally, so
  // @you/youtube and @zeema/youtube are different addresses and there is nothing to disambiguate
  // unless the cloner already has a design by that name, which `uniqueSlug` handles.
  const title = input.title ?? view.design.title;
  const created = await createDesign(viewer, {
    title,
    slug: input.slug ?? view.design.slug,
    summary: view.design.summary ?? undefined,
    visibility: "private",
    yaml,
    layout: input.layout ?? view.version?.layout ?? undefined,
    message: `cloned from ${ownerSegment(view.owner)}/${view.design.slug}`,
    sourceDesignId: view.design.id,
  });
  await recordEvent(view.design.id, viewer, "clone");
  countWrite("clone");
  await emit("clone", () => notifyClone(view.design, viewer.id));
  return created;
}

/** Views and exports count once per visitor, design and kind in this window. */
const EVENT_DEDUP_MS = 60 * 60_000;

/**
 * Count a view, clone or export. A clone is counted every time: it creates a design, needs a
 * session and is rate-limited. A view or an export counts once per visitor (the account, or the
 * hashed address for anonymous readers), design and kind per hour, so a refresh loop or a
 * script cannot move the leaderboard. Answers whether the event counted.
 */
export async function recordEvent(
  designId: string,
  viewer: Viewer,
  kind: "view" | "clone" | "export",
  opts: { format?: string; ip?: string } = {},
) {
  const db = await getDb();
  const ipHash = opts.ip
    ? createHash("sha256")
        .update(`${eventSalt()}:${opts.ip}:${new Date().toISOString().slice(0, 10)}`)
        .digest("hex")
    : null;
  if (kind !== "clone") {
    const who = viewer
      ? eq(schema.designEvents.actorId, viewer.id)
      : ipHash
        ? and(isNull(schema.designEvents.actorId), eq(schema.designEvents.ipHash, ipHash))
        : null;
    if (!who) return false;
    const recent = await db
      .select({ id: schema.designEvents.id })
      .from(schema.designEvents)
      .where(
        and(
          eq(schema.designEvents.designId, designId),
          eq(schema.designEvents.kind, kind),
          who,
          gt(schema.designEvents.createdAt, new Date(Date.now() - EVENT_DEDUP_MS)),
        ),
      )
      .limit(1);
    if (recent[0]) return false;
  }
  if (kind === "export") countExport(opts.format ?? "unknown");
  await db
    .insert(schema.designEvents)
    .values({ designId, actorId: viewer?.id ?? null, kind, format: opts.format ?? null, ipHash });
  const col =
    kind === "view"
      ? schema.designStats.viewCount
      : kind === "clone"
        ? schema.designStats.cloneCount
        : schema.designStats.exportCount;
  await db
    .insert(schema.designStats)
    .values({
      designId,
      viewCount: kind === "view" ? 1 : 0,
      cloneCount: kind === "clone" ? 1 : 0,
      exportCount: kind === "export" ? 1 : 0,
    })
    .onConflictDoUpdate({
      target: schema.designStats.designId,
      set: {
        [kind === "view" ? "viewCount" : kind === "clone" ? "cloneCount" : "exportCount"]:
          sql`${col} + 1`,
        updatedAt: new Date(),
      },
    });
  return true;
}

export async function getUserProfile(username: string) {
  const db = await getDb();
  const rows = await db
    .select()
    .from(schema.users)
    .where(
      and(
        eq(sql`lower(${schema.users.username})`, username.toLowerCase()),
        isNull(schema.users.deletedAt),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export type ProfileStats = {
  /** Public designs with a release. */
  designs: number;
  /** Clones of those designs, summed. */
  clones: number;
  followers: number;
  following: number;
  /** The owner's private or never-released designs; null for everyone else. */
  drafts: number | null;
};

/**
 * A profile's header numbers in one query. Only public, released, undeleted designs count toward
 * designs and clones; closed accounts are left out of the follow counts, as they are out of the
 * lists. The drafts count is the owner's alone.
 */
export async function getProfileStats(username: string, viewer: Viewer) {
  const user = await getUserProfile(username);
  if (!user) return null;
  const own = viewer?.id === user.id;
  const db = await getDb();
  const released = sql`d.owner_id = ${user.id} and d.deleted_at is null
    and d.visibility = 'public' and d.published_version_id is not null`;
  const [row] = await db
    .select({
      designs: sql<number>`(select count(*)::int from designs d where ${released})`,
      clones: sql<number>`(select coalesce(sum(s.clone_count), 0)::int from designs d
        join design_stats s on s.design_id = d.id where ${released})`,
      followers: sql<number>`(select count(*)::int from follows f
        join users x on x.id = f.follower_id and x.deleted_at is null
        where f.followee_id = ${user.id})`,
      following: sql<number>`(select count(*)::int from follows f
        join users x on x.id = f.followee_id and x.deleted_at is null
        where f.follower_id = ${user.id})`,
      drafts: sql<number>`(select count(*)::int from designs d
        where d.owner_id = ${user.id} and d.deleted_at is null
          and (d.visibility = 'private' or d.published_version_id is null))`,
      viewerFollows: viewer
        ? sql<boolean>`exists (select 1 from follows f
            where f.follower_id = ${viewer.id} and f.followee_id = ${user.id})`
        : sql<boolean>`false`,
    })
    .from(schema.users)
    .where(eq(schema.users.id, user.id));
  const stats: ProfileStats = {
    designs: Number(row.designs),
    clones: Number(row.clones),
    followers: Number(row.followers),
    following: Number(row.following),
    drafts: own ? Number(row.drafts) : null,
  };
  return { user, own, stats, viewerFollows: Boolean(row.viewerFollows) };
}
