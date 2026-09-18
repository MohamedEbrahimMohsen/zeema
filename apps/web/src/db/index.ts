// One database handle for the process. DATABASE_URL selects a real Postgres; without it an
// embedded Postgres (PGlite) lives under apps/web/.pglite so the app runs with nothing installed.
// Migrations run once at first use in both cases, so a fresh clone starts with the schema.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import { migrate as migratePostgres } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import * as schema from "./schema";

const here = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = fs.existsSync(path.join(here, "..", "..", "drizzle"))
  ? path.join(here, "..", "..", "drizzle")
  : path.join(process.cwd(), "drizzle");

export type Db =
  | ReturnType<typeof drizzlePglite<typeof schema>>
  | ReturnType<typeof drizzlePostgres<typeof schema>>;

type Holder = { db?: Db; ready?: Promise<Db>; kind?: "pglite" | "postgres" };
const g = globalThis as unknown as { __zeemaDb?: Holder };
if (!g.__zeemaDb) g.__zeemaDb = {};
const holder: Holder = g.__zeemaDb;

async function open(): Promise<Db> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const client = postgres(url, { max: 10, prepare: false });
    const db = drizzlePostgres(client, { schema });
    await migratePostgres(db, { migrationsFolder });
    holder.kind = "postgres";
    return db;
  }
  const dir = process.env.PGLITE_DIR ?? path.join(process.cwd(), ".pglite");
  const client = new PGlite(dir);
  const db = drizzlePglite(client, { schema });
  await migratePglite(db, { migrationsFolder });
  holder.kind = "pglite";
  return db;
}

export function getDb(): Promise<Db> {
  if (holder.db) return Promise.resolve(holder.db);
  if (!holder.ready)
    holder.ready = open().then((db) => {
      holder.db = db;
      return db;
    });
  return holder.ready;
}

export const dbKind = () => holder.kind ?? (process.env.DATABASE_URL ? "postgres" : "pglite");
export { schema };
