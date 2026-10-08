// Prepare a deployment for a beta: keep one account's designs and delete everything else, the
// owner-less curated designs and every other member's designs alike. Optionally make the kept
// designs public through the same service call the "Make public" button makes.
//
//   node --import tsx/esm src/db/keep-only.ts --owner <username> [--yes] [--public]
//                                             [--include-curated-only]
//
// A dry run unless --yes is given. Deletion is a purge, not the tombstone a member's own delete
// leaves: the rows go, design_slugs with them, in one transaction. Accounts are left alone.
// Set AUTO_SEED=0 afterwards when the curated designs are deleted, or the next boot of an empty
// table seeds them again (instrumentation.ts) -- which is also why an owner with no designs is
// refused outright.
import { count, eq, sql } from "drizzle-orm";
import { getDesign, patchDesign, purgeDesign, ServiceError } from "../lib/designs";
import type { SessionUser } from "../lib/viewer";
import { getDb, schema } from "./index";

export type KeepOnlyOptions = {
  owner: string;
  /** Without it nothing is written. */
  yes?: boolean;
  /** Make every kept design of the owner public. */
  makePublic?: boolean;
  /** Delete only the owner-less curated designs; keep every member's designs. */
  curatedOnly?: boolean;
};

export type Row = {
  id: string;
  owner: string;
  slug: string;
  visibility: "public" | "private";
  versions: number;
  /** A tombstone: removed by its author after it was published. */
  tombstone: boolean;
};

export type KeepOnlyReport = {
  owner: string;
  dryRun: boolean;
  deleted: Row[];
  kept: Row[];
  /** Kept designs that are (or, in a dry run, would be) made public. */
  madePublic: Row[];
  /** Kept private designs that cannot be made public, and why. */
  notPublic: { row: Row; reason: string }[];
};

export function parseArgs(argv: string[]): KeepOnlyOptions {
  const opts: KeepOnlyOptions = { owner: "" };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--owner") opts.owner = argv[++i] ?? "";
    else if (a.startsWith("--owner=")) opts.owner = a.slice("--owner=".length);
    else if (a === "--yes") opts.yes = true;
    else if (a === "--dry-run") opts.yes = false;
    else if (a === "--public") opts.makePublic = true;
    else if (a === "--include-curated-only") opts.curatedOnly = true;
    else throw new Error(`unknown argument ${a}`);
  }
  if (!opts.owner) throw new Error("--owner <username> is required");
  // --dry-run wins wherever it appears: asking for one never writes.
  if (argv.includes("--dry-run")) opts.yes = false;
  return opts;
}

export async function keepOnly(opts: KeepOnlyOptions): Promise<KeepOnlyReport> {
  const db = await getDb();
  const [found] = await db
    .select()
    .from(schema.users)
    .where(eq(sql`lower(${schema.users.username})`, opts.owner.toLowerCase()))
    .limit(1);
  if (!found) throw new Error(`no account named ${opts.owner}`);

  const versions = await db
    .select({ designId: schema.designVersions.designId, n: count() })
    .from(schema.designVersions)
    .groupBy(schema.designVersions.designId);
  const versionCount = new Map(versions.map((v) => [v.designId, Number(v.n)]));
  const all = await db
    .select({ design: schema.designs, username: schema.users.username })
    .from(schema.designs)
    .leftJoin(schema.users, eq(schema.users.id, schema.designs.ownerId))
    .orderBy(schema.users.username, schema.designs.slug);
  const rows = all.map(({ design: d, username }) => ({
    row: {
      id: d.id,
      owner: username ?? "zeema",
      slug: d.slug,
      visibility: d.visibility,
      versions: versionCount.get(d.id) ?? 0,
      tombstone: Boolean(d.deletedAt),
    } satisfies Row,
    ownerId: d.ownerId,
  }));
  const keep = (ownerId: string | null) =>
    opts.curatedOnly ? ownerId !== null : ownerId === found.id;
  const kept = rows.filter((r) => keep(r.ownerId)).map((r) => r.row);
  const deleted = rows.filter((r) => !keep(r.ownerId)).map((r) => r.row);

  // An empty table reseeds itself at the next boot, which would undo the whole exercise.
  const live = rows.filter((r) => r.ownerId === found.id && !r.row.tombstone);
  if (live.length === 0)
    throw new Error(
      `${found.username} has no designs; keeping only theirs would empty the table and the next boot would seed it again`,
    );

  const report: KeepOnlyReport = {
    owner: found.username,
    dryRun: !opts.yes,
    deleted,
    kept,
    madePublic: [],
    notPublic: [],
  };

  if (opts.yes) {
    await db.transaction(async (tx) => {
      for (const r of deleted) await purgeDesign(r.id, tx);
    });
  }

  if (opts.makePublic) {
    // The owner, signed in as a member: whatever the service lets them do, this does.
    const viewer: SessionUser = { ...found, sessionId: "keep-only", roles: [], actingAdmin: false };
    for (const { row: r } of rows.filter((x) => x.ownerId === found.id)) {
      if (r.tombstone) {
        report.notPublic.push({ row: r, reason: "deleted by its owner (tombstone)" });
        continue;
      }
      if (r.visibility === "public") continue;
      try {
        // Ask the service, never re-derive its rules: can the owner write this, and is there a
        // head that going public would release?
        const view = await getDesign(found.username, r.slug, viewer);
        if (!view.can.write) {
          report.notPublic.push({ row: r, reason: "the owner cannot edit it" });
          continue;
        }
        if (!view.version) {
          report.notPublic.push({ row: r, reason: "no version to release" });
          continue;
        }
        if (opts.yes) await patchDesign(found.username, r.slug, viewer, { visibility: "public" });
        report.madePublic.push(r);
      } catch (e) {
        if (!(e instanceof ServiceError)) throw e;
        report.notPublic.push({ row: r, reason: `${e.status} ${e.message}` });
      }
    }
  }
  return report;
}

function table(rows: Row[]) {
  const head = ["owner", "slug", "visibility", "versions"];
  const body = rows.map((r) => [
    r.owner,
    r.slug,
    r.tombstone ? `${r.visibility} (tombstone)` : r.visibility,
    String(r.versions),
  ]);
  const width = head.map((h, i) => Math.max(h.length, ...body.map((b) => b[i].length)));
  const line = (cells: string[]) =>
    cells
      .map((c, i) => c.padEnd(width[i]))
      .join("  ")
      .trimEnd();
  return [line(head), line(width.map((w) => "-".repeat(w))), ...body.map(line)].join("\n");
}

export function formatReport(r: KeepOnlyReport): string {
  const will = r.dryRun ? "would be" : "was";
  const out: string[] = [];
  out.push(r.dryRun ? "DRY RUN: nothing written. Add --yes to apply." : "APPLIED.");
  out.push("", `Deleted (${will} deleted): ${r.deleted.length}`);
  if (r.deleted.length) out.push(table(r.deleted));
  out.push("", `Kept: ${r.kept.length}`);
  if (r.kept.length) out.push(table(r.kept));
  if (r.madePublic.length || r.notPublic.length) {
    out.push("", `Made public (${will} made public): ${r.madePublic.length}`);
    if (r.madePublic.length) out.push(table(r.madePublic));
    out.push("", `Left private: ${r.notPublic.length}`);
    for (const n of r.notPublic) out.push(`  ${n.row.owner}/${n.row.slug}: ${n.reason}`);
  }
  const versions = (rows: Row[]) => rows.reduce((s, x) => s + x.versions, 0);
  out.push(
    "",
    `Totals: ${r.deleted.length} design(s) / ${versions(r.deleted)} version(s) ${will} deleted; ` +
      `${r.kept.length} design(s) / ${versions(r.kept)} version(s) kept.`,
  );
  if (r.deleted.some((d) => d.owner === "zeema"))
    out.push(
      "",
      "Reminder: set AUTO_SEED=0 for the web service, or a boot that finds the designs table",
      "empty seeds the curated designs again.",
    );
  return out.join("\n");
}

if (process.argv[1] && /keep-only\.ts$/.test(process.argv[1])) {
  (async () => {
    try {
      const report = await keepOnly(parseArgs(process.argv.slice(2)));
      console.log(formatReport(report));
      process.exit(0);
    } catch (e) {
      console.error(`keep-only: ${e instanceof Error ? e.message : e}`);
      process.exit(1);
    }
  })();
}
