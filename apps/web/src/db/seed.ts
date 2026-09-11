// Seed the curated designs (reference and imported tiers) as owner-less, public, read-only
// designs, with broken twins attached as flagged versions. Idempotent: existing slugs are skipped.
import { and, eq, isNull, sql } from "drizzle-orm";
import { getCatalogue, repoDesigns } from "../lib/catalogue";
import { addBrokenVersion, createDesign } from "../lib/designs";
import { analyse } from "../lib/lint";
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
      .select({ id: schema.designs.id })
      .from(schema.designs)
      .where(and(isNull(schema.designs.ownerId), eq(sql`lower(${schema.designs.slug})`, slug)))
      .limit(1);
    if (existing[0]) continue;
    const { doc } = analyse(clean.yaml, cat);
    if (!doc) {
      log(`skip ${key}: does not parse`);
      continue;
    }
    const title = clean.id.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    const summary =
      firstParagraph(clean.notes) ??
      `${doc.nodes.length} components, ${doc.edges.length} edges. ${clean.tier === "reference" ? "Curated reference design." : "Imported from a published source."}`;
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

function firstParagraph(md: string | null) {
  if (!md) return null;
  const lines = md.split(/\r?\n/);
  const out: string[] = [];
  for (const l of lines) {
    const t = l.trim();
    if (
      t.startsWith("#") ||
      t.startsWith("-") ||
      t.startsWith("*") ||
      t.startsWith("|") ||
      t.startsWith("```")
    ) {
      if (out.length) break;
      continue;
    }
    if (t === "") {
      if (out.length) break;
      continue;
    }
    out.push(t);
  }
  const text = out.join(" ").replace(/[*_`]/g, "");
  return text ? text.slice(0, 280) : null;
}

if (process.argv[1] && /seed\.ts$/.test(process.argv[1])) {
  seedCurated().then((n) => {
    console.log(`${n} design(s) seeded`);
    process.exit(0);
  });
}
