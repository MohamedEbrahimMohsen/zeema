// Runs once per server start: open the database (migrating if needed) and seed the curated
// designs when the store is empty, so a fresh deployment has something to browse.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { getDb, schema } = await import("./src/db");
  const { seedCurated } = await import("./src/db/seed");
  try {
    const db = await getDb();
    const rows = await db.select({ id: schema.designs.id }).from(schema.designs).limit(1);
    if (!rows[0] && process.env.AUTO_SEED !== "0") {
      const n = await seedCurated((s) => console.log(`[seed] ${s}`));
      console.log(`[arkore] seeded ${n} curated design(s)`);
    }
  } catch (e) {
    console.error("[arkore] database not ready:", e);
  }
}
