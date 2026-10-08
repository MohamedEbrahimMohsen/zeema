// Move one account's designs between deployments, second half: insert a bundle written by
// export-owner.ts under an account that already exists on this deployment.
//
//   node --import tsx/esm src/db/import-owner.ts --in <file.json> --owner <username>
//                                                [--replace] [--yes]
//
// A dry run unless --yes is given. Every row gets a new id and every pointer between them
// (head, release, versions, reserved addresses, stats, a clone's source inside the bundle) is
// remapped; timestamps are kept to the microsecond. A version written by the exported account is
// credited to the target account; anyone else's authorship is dropped (author null), since that
// person may not exist here.
//
// An address the bundle needs (a design's slug or one of its reserved old slugs) that this owner
// already uses on the target is refused, unless --replace: then the target design holding it is
// purged (no tombstone) in the same transaction, before the insert. Owner-less (curated) designs
// and reservations live in their own namespace and never collide; they are reported, not
// touched. Nothing else is deleted -- keep-only.ts does that, run afterwards, so the designs table
// is never empty in between.

import { randomUUID } from "node:crypto";
import fs from "node:fs";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { purgeDesign } from "../lib/designs";
import {
  BUNDLE_FORMAT,
  BUNDLE_VERSION,
  type Bundle,
  type BundleRow,
  bundleRows,
  rowTable,
  table,
} from "./export-owner";
import { type Db, getDb, schema } from "./index";

export type ImportOptions = { in: string; owner: string; replace?: boolean; yes?: boolean };

export type ImportReport = {
  owner: string;
  dryRun: boolean;
  rows: BundleRow[];
  /** Per bundle design: "insert", or "replace" when it takes an address a target design held. */
  actions: ("insert" | "replace")[];
  /** Target designs of the owner that are (or would be) purged to make room. */
  replaced: { slug: string; versions: number; tombstone: boolean }[];
  notes: string[];
};

export function parseArgs(argv: string[]): ImportOptions {
  const opts: ImportOptions = { in: "", owner: "" };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--in") opts.in = argv[++i] ?? "";
    else if (a.startsWith("--in=")) opts.in = a.slice("--in=".length);
    else if (a === "--owner") opts.owner = argv[++i] ?? "";
    else if (a.startsWith("--owner=")) opts.owner = a.slice("--owner=".length);
    else if (a === "--replace") opts.replace = true;
    else if (a === "--yes") opts.yes = true;
    else if (a === "--dry-run") opts.yes = false;
    else throw new Error(`unknown argument ${a}`);
  }
  if (!opts.in) throw new Error("--in <file.json> is required");
  if (!opts.owner) throw new Error("--owner <username> is required");
  if (argv.includes("--dry-run")) opts.yes = false;
  return opts;
}

export function readBundle(text: string): Bundle {
  const b = JSON.parse(text) as Bundle;
  if (b?.format !== BUNDLE_FORMAT || b.version !== BUNDLE_VERSION || !Array.isArray(b.designs))
    throw new Error(`not a ${BUNDLE_FORMAT} v${BUNDLE_VERSION} bundle`);
  return b;
}

const ts = (s: string | null) => (s === null ? null : sql`${s}::timestamptz`);

export async function importOwner(
  bundle: Bundle,
  opts: { owner: string; replace?: boolean; yes?: boolean },
  db?: Db,
): Promise<ImportReport> {
  const d = db ?? (await getDb());
  const [user] = await d
    .select()
    .from(schema.users)
    .where(eq(sql`lower(${schema.users.username})`, opts.owner.toLowerCase()))
    .limit(1);
  if (!user)
    throw new Error(
      `no account named ${opts.owner} on this deployment: sign in once on the target first`,
    );
  const notes: string[] = [];
  if (user.githubId !== bundle.owner.githubId)
    notes.push(
      `the bundle was exported from ${bundle.owner.username} (github ${bundle.owner.githubId}); ` +
        `importing under ${user.username} (github ${user.githubId})`,
    );

  // Every address the bundle claims, and which bundle design claims it.
  const claim = new Map<string, number>();
  bundle.designs.forEach((x, i) => {
    for (const s of [x.slug, ...x.slugs.map((r) => r.slug)]) {
      const k = s.toLowerCase();
      if (claim.has(k) && claim.get(k) !== i)
        throw new Error(`the bundle claims ${s} twice; refusing a bundle that would not insert`);
      claim.set(k, i);
    }
  });
  const addrs = [...claim.keys()];
  const lowerSlug = (c: typeof schema.designs.slug | typeof schema.designSlugs.slug) =>
    sql<string>`lower(${c})`;

  const ownDesigns = addrs.length
    ? await d
        .select({
          id: schema.designs.id,
          slug: schema.designs.slug,
          deletedAt: schema.designs.deletedAt,
        })
        .from(schema.designs)
        .where(eq(schema.designs.ownerId, user.id))
    : [];
  const ownSlugs = addrs.length
    ? await d
        .select({
          id: schema.designSlugs.id,
          slug: schema.designSlugs.slug,
          designId: schema.designSlugs.designId,
        })
        .from(schema.designSlugs)
        .where(
          and(
            eq(schema.designSlugs.ownerId, user.id),
            inArray(lowerSlug(schema.designSlugs.slug), addrs),
          ),
        )
    : [];
  const byId = new Map(ownDesigns.map((x) => [x.id, x]));
  const conflicts = new Set<string>();
  const orphanSlugIds: string[] = [];
  const hit = new Set<number>();
  for (const x of ownDesigns)
    if (claim.has(x.slug.toLowerCase())) {
      conflicts.add(x.id);
      hit.add(claim.get(x.slug.toLowerCase())!);
    }
  for (const r of ownSlugs) {
    hit.add(claim.get(r.slug.toLowerCase())!);
    if (byId.has(r.designId)) conflicts.add(r.designId);
    else orphanSlugIds.push(r.id);
  }
  // Everything else a conflicting design reserves goes with it on a purge; it is not a claim.

  if ((conflicts.size || orphanSlugIds.length) && !opts.replace) {
    const taken = [...conflicts].map((id) => byId.get(id)!.slug).sort();
    throw new Error(
      `${user.username} already uses ${[...taken, ...(orphanSlugIds.length ? [`${orphanSlugIds.length} orphan reservation(s)`] : [])].join(", ")} ` +
        "on this deployment; add --replace to purge those designs and import over them",
    );
  }

  // Curated (owner-less) designs and reservations of the same name: a separate namespace.
  if (addrs.length) {
    const curated = await d
      .select({ slug: schema.designs.slug })
      .from(schema.designs)
      .where(and(isNull(schema.designs.ownerId), inArray(lowerSlug(schema.designs.slug), addrs)));
    const curatedRes = await d
      .select({ slug: schema.designSlugs.slug })
      .from(schema.designSlugs)
      .where(
        and(isNull(schema.designSlugs.ownerId), inArray(lowerSlug(schema.designSlugs.slug), addrs)),
      );
    for (const c of curated)
      notes.push(`a curated design is also named ${c.slug}; no collision (different owner)`);
    for (const c of curatedRes)
      notes.push(`a curated reservation also holds ${c.slug}; left alone (different owner)`);
  }

  const versionCounts = conflicts.size
    ? await d
        .select({ designId: schema.designVersions.designId, n: sql<number>`count(*)::int` })
        .from(schema.designVersions)
        .where(inArray(schema.designVersions.designId, [...conflicts]))
        .groupBy(schema.designVersions.designId)
    : [];
  const replaced = [...conflicts]
    .map((id) => ({
      slug: byId.get(id)!.slug,
      versions: Number(versionCounts.find((v) => v.designId === id)?.n ?? 0),
      tombstone: Boolean(byId.get(id)!.deletedAt),
    }))
    .sort((a, b) => a.slug.localeCompare(b.slug));
  if (orphanSlugIds.length)
    notes.push(`${orphanSlugIds.length} reservation(s) pointing at no design are removed`);

  const report: ImportReport = {
    owner: user.username,
    dryRun: !opts.yes,
    rows: bundleRows(bundle),
    actions: bundle.designs.map((_, i) => (hit.has(i) ? "replace" : "insert")),
    replaced,
    notes,
  };
  if (!opts.yes) return report;

  // New ids up front, so every pointer is written once, in the row that carries it.
  const designId = new Map(bundle.designs.map((x) => [x.id, randomUUID()]));
  const versionId = new Map(
    bundle.designs.flatMap((x) => x.versions.map((v) => [v.id, randomUUID()] as const)),
  );
  const remap = (m: Map<string, string>, id: string | null) => (id ? (m.get(id) ?? null) : null);

  await d.transaction(async (tx) => {
    for (const id of conflicts) await purgeDesign(id, tx);
    if (orphanSlugIds.length)
      await tx.delete(schema.designSlugs).where(inArray(schema.designSlugs.id, orphanSlugIds));
    for (const x of bundle.designs) {
      const id = designId.get(x.id)!;
      await tx.insert(schema.designs).values({
        id,
        ownerId: user.id,
        slug: x.slug,
        title: x.title,
        summary: x.summary,
        readme: x.readme,
        visibility: x.visibility,
        origin: x.origin,
        sourceDesignId: remap(designId, x.sourceDesignId),
        currentVersionId: remap(versionId, x.currentVersionId),
        publishedVersionId: remap(versionId, x.publishedVersionId),
        tags: x.tags,
        searchText: x.searchText,
        createdAt: ts(x.createdAt)!,
        updatedAt: ts(x.updatedAt)!,
        publishedAt: ts(x.publishedAt),
        deletedAt: ts(x.deletedAt),
      });
      for (const v of x.versions)
        await tx.insert(schema.designVersions).values({
          id: versionId.get(v.id)!,
          designId: id,
          yaml: v.yaml,
          layout: v.layout ?? null,
          contentHash: v.contentHash,
          authorId: v.authorIsOwner ? user.id : null,
          message: v.message,
          broken: v.broken,
          createdAt: ts(v.createdAt)!,
          publishedAt: ts(v.publishedAt),
        });
      for (const r of x.slugs)
        await tx.insert(schema.designSlugs).values({
          ownerId: user.id,
          slug: r.slug,
          designId: id,
          reservedAt: ts(r.reservedAt)!,
        });
      if (x.stats)
        await tx.insert(schema.designStats).values({
          designId: id,
          viewCount: x.stats.viewCount,
          cloneCount: x.stats.cloneCount,
          exportCount: x.stats.exportCount,
          updatedAt: ts(x.stats.updatedAt)!,
        });
    }
  });
  return report;
}

export function formatImport(r: ImportReport): string {
  const will = r.dryRun ? "would be" : "was";
  const out: string[] = [];
  out.push(r.dryRun ? "DRY RUN: nothing written. Add --yes to apply." : "APPLIED.");
  out.push("", `Imported under ${r.owner} (${will} inserted): ${r.rows.length}`);
  if (r.rows.length) out.push(rowTable(r.rows, (_, i) => r.actions[i]));
  out.push("", `Replaced (${will} purged first): ${r.replaced.length}`);
  if (r.replaced.length)
    out.push(
      table(
        ["slug", "versions"],
        r.replaced.map((x) => [x.tombstone ? `${x.slug} (tombstone)` : x.slug, String(x.versions)]),
      ),
    );
  for (const n of r.notes) out.push(`Note: ${n}`);
  const versions = r.rows.reduce((n, x) => n + x.versions, 0);
  out.push(
    "",
    `Totals: ${r.rows.length} design(s) / ${versions} version(s) ${will} inserted; ` +
      `${r.replaced.length} design(s) ${will} replaced.`,
  );
  return out.join("\n");
}

if (process.argv[1] && /import-owner\.ts$/.test(process.argv[1])) {
  (async () => {
    try {
      const opts = parseArgs(process.argv.slice(2));
      const bundle = readBundle(fs.readFileSync(opts.in, "utf8"));
      console.log(formatImport(await importOwner(bundle, opts)));
      process.exit(0);
    } catch (e) {
      console.error(`import-owner: ${e instanceof Error ? e.message : e}`);
      process.exit(1);
    }
  })();
}
