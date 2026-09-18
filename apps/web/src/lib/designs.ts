// The design service: every read and write the pages and the API perform, with the
// authorization matrix (plan, section 13) applied here and nowhere else. Interfaces derive
// their own state ("can I edit this?") from the answers these functions give.
import { createHash } from "node:crypto";
import { and, desc, eq, ilike, isNotNull, isNull, or, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { Design, DesignVersion } from "@/db/schema";
import { brandMarkFor } from "./brand";
import { type Catalogue, getCatalogue } from "./catalogue";
import { analyse } from "./lint";
import { countExport, countWrite } from "./metrics";
import { type Sketch, sketchOf } from "./sketch";
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
export const toSlug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || "design";

const MAX_YAML = 512 * 1024;

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
  owner?: string;
  sort?: "updated" | "created" | "clones" | "exports";
  page?: number;
  pageSize?: number;
  /** `all` (every design, private included) is available to an acting admin only. */
  scope?: "public" | "mine" | "all";
  /** With scope `all`: restrict to one visibility. */
  visibility?: "public" | "private";
};

/** Browse. Visibility is inside the query, never filtered afterwards. */
export async function listDesigns(
  viewer: Viewer,
  opts: ListOptions = {},
): Promise<{ items: DesignSummary[]; total: number; page: number; pageSize: number }> {
  const db = await getDb();
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 24));
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
    for (const t of terms)
      conds.push(
        or(
          ilike(schema.designs.title, `%${t}%`),
          ilike(schema.designs.summary, `%${t}%`),
          ilike(schema.designs.searchText, `%${t}%`),
        )!,
      );
  }
  if (opts.provider) conds.push(ilike(schema.designs.searchText, `%provider:${opts.provider}%`));
  if (opts.kind) conds.push(ilike(schema.designs.searchText, `%kind:${opts.kind}%`));
  const where = and(...conds);
  const order =
    opts.sort === "clones"
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
      unpublished: design.currentVersionId !== design.publishedVersionId,
      stats: {
        viewCount: stats?.viewCount ?? 0,
        cloneCount: stats?.cloneCount ?? 0,
        exportCount: stats?.exportCount ?? 0,
      },
      providers: [
        ...new Set((design.searchText.match(/provider:([a-z]+)/g) ?? []).map((m) => m.slice(9))),
      ],
      nodeCount: Number(/nodes:(\d+)/.exec(design.searchText)?.[1] ?? 0),
      brand: brandMarkFor(design.slug),
      sketch: yaml ? sketchOf(yaml, cat) : null,
    })),
    total: Number(count),
    page,
    pageSize,
  };
}

// ---------------------------------------------------------------- writes

function searchTextFor(yaml: string, cat: Catalogue) {
  const { doc } = analyse(yaml, cat);
  if (!doc) return "";
  const parts = new Set<string>();
  for (const n of doc.nodes) {
    const c = cat.components[n.component];
    parts.add(`component:${n.component}`);
    if (c) {
      parts.add(`provider:${c.provider}`);
      parts.add(`kind:${c.kind}`);
      parts.add(cat.locale.components[n.component]?.name ?? "");
    }
    if (n.label) parts.add(String(n.label));
  }
  return `${[...parts].join(" ")} nodes:${doc.nodes.length}`;
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

async function uniqueSlug(ownerId: string | null, wanted: string) {
  const db = await getDb();
  const base = toSlug(wanted);
  for (let n = 0; n < 100; n++) {
    const candidate = n ? `${base}-${n + 1}` : base;
    const rows = await db
      .select({ id: schema.designs.id })
      .from(schema.designs)
      .where(
        and(
          ownerId ? eq(schema.designs.ownerId, ownerId) : isNull(schema.designs.ownerId),
          eq(sql`lower(${schema.designs.slug})`, candidate),
        ),
      )
      .limit(1);
    if (!rows[0]) return candidate;
  }
  throw new ServiceError(409, "no free slug");
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
      layout: input.layout ?? null,
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
  const hash = contentHash(input.yaml);
  if (
    view.version &&
    hash === view.version.contentHash &&
    JSON.stringify(input.layout ?? null) === JSON.stringify(view.version.layout ?? null)
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
      .set({ yaml: input.yaml, layout: input.layout ?? null, contentHash: hash })
      .where(eq(schema.designVersions.id, head.id))
      .returning();
  } else {
    [version] = await db
      .insert(schema.designVersions)
      .values({
        designId: view.design.id,
        yaml: input.yaml,
        layout: input.layout ?? null,
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
  const [design] = await db
    .update(schema.designs)
    .set({
      publishedVersionId: head.id,
      publishedAt: view.design.publishedAt ?? now,
      updatedAt: now,
    })
    .where(eq(schema.designs.id, view.design.id))
    .returning();
  countWrite("publish");
  return { design, version, unchanged: false };
}

export type PatchInput = {
  title?: string;
  summary?: string;
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
  if (input.summary !== undefined) set.summary = input.summary.slice(0, 280) || null;
  if (input.visibility !== undefined) {
    if (!["public", "private"].includes(input.visibility))
      throw new ServiceError(400, "visibility must be public or private");
    set.visibility = input.visibility;
    if (input.visibility === "public" && !view.design.publishedAt) set.publishedAt = new Date();
    // Going public with nothing released yet releases the head, so the page is not empty.
    if (input.visibility === "public" && !view.design.publishedVersionId && view.version) {
      set.publishedVersionId = view.version.id;
      await db
        .update(schema.designVersions)
        .set({ publishedAt: new Date() })
        .where(eq(schema.designVersions.id, view.version.id));
    }
  }
  if (input.tags !== undefined) set.tags = input.tags.map(toSlug).filter(Boolean).slice(0, 10);
  const [design] = await db
    .update(schema.designs)
    .set(set)
    .where(eq(schema.designs.id, view.design.id))
    .returning();
  return design;
}

export async function deleteDesign(owner: string, slug: string, viewer: Viewer) {
  const db = await getDb();
  const view = await getDesign(owner, slug, viewer);
  if (!view.can.write) throw new ServiceError(403, "you cannot delete this design");
  await db
    .update(schema.designs)
    .set({ deletedAt: new Date() })
    .where(eq(schema.designs.id, view.design.id));
  countWrite("delete");
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
  const title = input.title ?? `${view.design.title} (copy)`;
  const created = await createDesign(viewer, {
    title,
    slug: input.slug ?? `${view.design.slug}-copy`,
    summary: view.design.summary ?? undefined,
    visibility: "private",
    yaml,
    layout: input.layout ?? view.version?.layout ?? undefined,
    message: `cloned from ${ownerSegment(view.owner)}/${view.design.slug}`,
    sourceDesignId: view.design.id,
  });
  await recordEvent(view.design.id, viewer, "clone");
  countWrite("clone");
  return created;
}

export async function recordEvent(
  designId: string,
  viewer: Viewer,
  kind: "view" | "clone" | "export",
  opts: { format?: string; ip?: string } = {},
) {
  const db = await getDb();
  if (kind === "export") countExport(opts.format ?? "unknown");
  const ipHash = opts.ip
    ? createHash("sha256")
        .update(
          `${process.env.EVENT_SALT ?? "zeema"}:${opts.ip}:${new Date().toISOString().slice(0, 10)}`,
        )
        .digest("hex")
    : null;
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
