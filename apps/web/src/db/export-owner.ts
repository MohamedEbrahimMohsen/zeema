// Move one account's designs between deployments, first half: write every design the account
// owns, with all of its versions (layout sidecars ride on the version rows), its reserved
// addresses and its stats, to a plain JSON bundle that import-owner.ts reads on the other side.
//
//   node --import tsx/esm src/db/export-owner.ts --owner <username> --out <file.json>
//                                                [--no-tombstones]
//
// Read-only: nothing in the database is written. Sessions, notifications, events and follows
// stay behind; they belong to the deployment, not to the designs. A tombstone (a design its
// owner deleted after publishing it) is exported, flagged, so the addresses it reserves stay
// reserved on the target; --no-tombstones leaves them out.
//
// The output is deterministic: designs by slug, versions by creation time, LF line endings, no
// export timestamp, and timestamps at the database's own microsecond precision.
import fs from "node:fs";
import { and, asc, eq, inArray, type SQL, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { type Db, getDb, schema } from "./index";

export const BUNDLE_FORMAT = "zeema-owner-export";
export const BUNDLE_VERSION = 1;

export type BundleVersion = {
  id: string;
  yaml: string;
  layout: unknown;
  contentHash: string;
  /** Written by the exported account; anyone else's authorship is not carried across. */
  authorIsOwner: boolean;
  message: string | null;
  broken: boolean;
  createdAt: string;
  publishedAt: string | null;
};

export type BundleDesign = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  readme: string | null;
  visibility: "public" | "private";
  origin: "authored" | "imported" | "reference";
  sourceDesignId: string | null;
  currentVersionId: string | null;
  publishedVersionId: string | null;
  tags: string[];
  searchText: string;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  deletedAt: string | null;
  /** Deleted by its owner after it was published: kept so its addresses stay reserved. */
  tombstone: boolean;
  versions: BundleVersion[];
  slugs: { slug: string; reservedAt: string }[];
  stats: {
    viewCount: number;
    cloneCount: number;
    exportCount: number;
    updatedAt: string;
  } | null;
};

export type Bundle = {
  format: typeof BUNDLE_FORMAT;
  version: typeof BUNDLE_VERSION;
  owner: { username: string; githubId: number };
  designs: BundleDesign[];
};

export type ExportOptions = { owner: string; out: string; tombstones?: boolean };

/** A timestamp as UTC ISO-8601 text with microseconds: a JS Date would drop the last three. */
export const iso = (c: AnyPgColumn | SQL) =>
  sql<string>`to_char(${c} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`;
/** `iso` for a nullable column. */
const isoOrNull = (c: AnyPgColumn) => iso(c) as SQL<string | null>;

export function parseArgs(argv: string[]): ExportOptions {
  const opts: ExportOptions = { owner: "", out: "", tombstones: true };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--owner") opts.owner = argv[++i] ?? "";
    else if (a.startsWith("--owner=")) opts.owner = a.slice("--owner=".length);
    else if (a === "--out") opts.out = argv[++i] ?? "";
    else if (a.startsWith("--out=")) opts.out = a.slice("--out=".length);
    else if (a === "--no-tombstones") opts.tombstones = false;
    else throw new Error(`unknown argument ${a}`);
  }
  if (!opts.owner) throw new Error("--owner <username> is required");
  if (!opts.out) throw new Error("--out <file.json> is required");
  return opts;
}

export async function exportOwner(
  opts: { owner: string; tombstones?: boolean },
  db?: Db,
): Promise<Bundle> {
  const d = db ?? (await getDb());
  const [user] = await d
    .select()
    .from(schema.users)
    .where(eq(sql`lower(${schema.users.username})`, opts.owner.toLowerCase()))
    .limit(1);
  if (!user) throw new Error(`no account named ${opts.owner}`);

  const t = schema.designs;
  const designs = (
    await d
      .select({
        id: t.id,
        slug: t.slug,
        title: t.title,
        summary: t.summary,
        readme: t.readme,
        visibility: t.visibility,
        origin: t.origin,
        sourceDesignId: t.sourceDesignId,
        currentVersionId: t.currentVersionId,
        publishedVersionId: t.publishedVersionId,
        tags: t.tags,
        searchText: t.searchText,
        createdAt: iso(t.createdAt),
        updatedAt: iso(t.updatedAt),
        publishedAt: isoOrNull(t.publishedAt),
        deletedAt: isoOrNull(t.deletedAt),
      })
      .from(t)
      .where(eq(t.ownerId, user.id))
      .orderBy(sql`lower(${t.slug})`, asc(t.id))
  ).filter((x) => opts.tombstones !== false || !x.deletedAt);
  const ids = designs.map((x) => x.id);

  const v = schema.designVersions;
  const versions = ids.length
    ? await d
        .select({
          id: v.id,
          designId: v.designId,
          yaml: v.yaml,
          layout: v.layout,
          contentHash: v.contentHash,
          authorId: v.authorId,
          message: v.message,
          broken: v.broken,
          createdAt: iso(v.createdAt),
          publishedAt: isoOrNull(v.publishedAt),
        })
        .from(v)
        .where(inArray(v.designId, ids))
        .orderBy(asc(v.createdAt), asc(v.id))
    : [];
  const s = schema.designSlugs;
  const slugs = ids.length
    ? await d
        .select({ designId: s.designId, slug: s.slug, reservedAt: iso(s.reservedAt) })
        .from(s)
        .where(and(eq(s.ownerId, user.id), inArray(s.designId, ids)))
        .orderBy(asc(s.reservedAt), sql`lower(${s.slug})`)
    : [];
  const st = schema.designStats;
  const stats = ids.length
    ? await d
        .select({
          designId: st.designId,
          viewCount: st.viewCount,
          cloneCount: st.cloneCount,
          exportCount: st.exportCount,
          updatedAt: iso(st.updatedAt),
        })
        .from(st)
        .where(inArray(st.designId, ids))
    : [];

  return {
    format: BUNDLE_FORMAT,
    version: BUNDLE_VERSION,
    owner: { username: user.username, githubId: user.githubId },
    designs: designs.map((x) => {
      const stat = stats.find((r) => r.designId === x.id);
      return {
        ...x,
        tombstone: Boolean(x.deletedAt),
        versions: versions
          .filter((r) => r.designId === x.id)
          .map(({ designId: _, authorId, ...r }) => ({
            id: r.id,
            yaml: r.yaml,
            layout: r.layout ?? null,
            contentHash: r.contentHash,
            authorIsOwner: authorId === user.id,
            message: r.message,
            broken: r.broken,
            createdAt: r.createdAt,
            publishedAt: r.publishedAt,
          })),
        slugs: slugs
          .filter((r) => r.designId === x.id)
          .map((r) => ({ slug: r.slug, reservedAt: r.reservedAt })),
        stats: stat
          ? {
              viewCount: stat.viewCount,
              cloneCount: stat.cloneCount,
              exportCount: stat.exportCount,
              updatedAt: stat.updatedAt,
            }
          : null,
      };
    }),
  };
}

/** The bundle as written to disk: two-space JSON, LF, trailing newline. */
export const serializeBundle = (b: Bundle) => `${JSON.stringify(b, null, 2)}\n`;

export type BundleRow = {
  slug: string;
  visibility: string;
  versions: number;
  published: boolean;
  tombstone: boolean;
};

export const bundleRows = (b: Bundle): BundleRow[] =>
  b.designs.map((x) => ({
    slug: x.slug,
    visibility: x.visibility,
    versions: x.versions.length,
    published: Boolean(x.publishedVersionId),
    tombstone: x.tombstone,
  }));

export function table(head: string[], body: string[][]) {
  const width = head.map((h, i) => Math.max(h.length, ...body.map((b) => b[i].length)));
  const line = (cells: string[]) =>
    cells
      .map((c, i) => c.padEnd(width[i]))
      .join("  ")
      .trimEnd();
  return [line(head), line(width.map((w) => "-".repeat(w))), ...body.map(line)].join("\n");
}

export const rowTable = (rows: BundleRow[], extra?: (r: BundleRow, i: number) => string) =>
  table(
    ["slug", "visibility", "versions", "published", ...(extra ? ["action"] : [])],
    rows.map((r, i) => [
      r.slug,
      r.tombstone ? `${r.visibility} (tombstone)` : r.visibility,
      String(r.versions),
      r.published ? "yes" : "no",
      ...(extra ? [extra(r, i)] : []),
    ]),
  );

export function formatExport(b: Bundle, out: string) {
  const rows = bundleRows(b);
  const versions = rows.reduce((n, r) => n + r.versions, 0);
  return [
    `Exported ${b.owner.username} (github ${b.owner.githubId}) to ${out}`,
    "",
    rowTable(rows),
    "",
    `Totals: ${rows.length} design(s), ${rows.filter((r) => r.tombstone).length} tombstone(s), ${versions} version(s).`,
  ].join("\n");
}

if (process.argv[1] && /export-owner\.ts$/.test(process.argv[1])) {
  (async () => {
    try {
      const opts = parseArgs(process.argv.slice(2));
      const bundle = await exportOwner(opts);
      fs.writeFileSync(opts.out, serializeBundle(bundle));
      console.log(formatExport(bundle, opts.out));
      process.exit(0);
    } catch (e) {
      console.error(`export-owner: ${e instanceof Error ? e.message : e}`);
      process.exit(1);
    }
  })();
}
