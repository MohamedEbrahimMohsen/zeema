// Runs once per server start: install the metrics collectors, then open the database
// (migrating if needed) and seed the curated designs when the store is empty, so a fresh
// deployment has something to browse.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // Refuse to start on a configuration that would lose data or weaken the event log.
  const { bootProblems } = await import("./src/lib/boot");
  const problems = bootProblems();
  if (problems.length) {
    for (const p of problems) console.error(`[zeema] refusing to start: ${p}`);
    throw new Error(`refusing to start: ${problems.join(" ")}`);
  }
  const { installHttpMetrics } = await import("./src/lib/metrics");
  installHttpMetrics();
  const { getDb, schema } = await import("./src/db");
  const { seedCurated } = await import("./src/db/seed");
  try {
    const db = await getDb();
    const rows = await db.select({ id: schema.designs.id }).from(schema.designs).limit(1);
    if (!rows[0] && process.env.AUTO_SEED !== "0") {
      const n = await seedCurated((s) => console.log(`[seed] ${s}`));
      console.log(`[zeema] seeded ${n} curated design(s)`);
    }
  } catch (e) {
    console.error("[zeema] database not ready:", e);
  }
}
