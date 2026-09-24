// Seed the curated designs (reference and imported tiers) as owner-less, public, read-only
// designs, with broken twins attached as flagged versions. Idempotent: an existing slug is not
// inserted again, but its summary is refreshed when the one derived from notes.md has changed,
// so a database seeded before a notes edit does not keep the old text forever. Only that column
// moves: no version, layout or timestamp, so listings keep their order. Owner-less designs
// cannot be edited by any member, so this never overwrites a person's text.
import { and, eq, isNull, sql } from "drizzle-orm";
import { getCatalogue, repoDesigns } from "../lib/catalogue";
import { addBrokenVersion, createDesign } from "../lib/designs";
import { analyse } from "../lib/lint";
import { firstParagraph } from "../lib/notes-summary";
import { getDb, schema } from "./index";

export async function seedCurated(log: (s: string) => void = console.log) {
  const db = await getDb();
  const cat = getCatalogue();
  const entries = repoDesigns().filter((e) => e.tier !== "authored");
  const byId = new Map<string, (typeof entries)[number][]>();
  for (const e of entries) {
    const key = `${e.tier}/${e.id}`;
    if (!byId.has(key)) byId.set(key, []);
    byId.get(key)!.push(e);
  }
  let created = 0;
  for (const [key, files] of byId) {
    const clean = files.find((f) => !f.broken);
    if (!clean) continue;
    const slug = clean.id;
    const existing = await db
      .select({ id: schema.designs.id, summary: schema.designs.summary })
      .from(schema.designs)
      .where(and(isNull(schema.designs.ownerId), eq(sql`lower(${schema.designs.slug})`, slug)))
      .limit(1);
    const { doc } = analyse(clean.yaml, cat);
    if (!doc) {
      log(`skip ${key}: does not parse`);
      continue;
    }
    const summary =
      firstParagraph(clean.notes) ??
      `${doc.nodes.length} components, ${doc.edges.length} edges. ${clean.tier === "reference" ? "Curated reference design." : "Imported from a published source."}`;
    if (existing[0]) {
      if (existing[0].summary !== summary) {
        await db
          .update(schema.designs)
          .set({ summary })
          .where(and(eq(schema.designs.id, existing[0].id), isNull(schema.designs.ownerId)));
        log(`refreshed summary ${key}`);
      }
      continue;
    }
    const title = clean.id.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    const { design } = await createDesign(
      null,
      {
        title,
        slug,
        summary,
        yaml: clean.yaml,
        layout: clean.layout ?? undefined,
        origin: clean.tier as "reference" | "imported",
        message: "seeded from the repository",
      },
      { curated: true },
    );
    const broken = files.find((f) => f.broken);
    if (broken) await addBrokenVersion(design.id, broken.yaml);
    created++;
    log(`seeded ${key}`);
  }
  return created;
}

if (process.argv[1] && /seed\.ts$/.test(process.argv[1])) {
  seedCurated().then((n) => {
    console.log(`${n} design(s) seeded`);
    process.exit(0);
  });
}
