// One database handle for the process. DATABASE_URL selects a real Postgres; without it an
// embedded Postgres (PGlite) lives under apps/web/.pglite so the app runs with nothing installed.
// Production never takes that fallback: an unset DATABASE_URL there is an error, because the
// embedded store would live inside the container and vanish with it.
// Migrations run once at first use in both cases, so a fresh clone starts with the schema. On
// Postgres they run under an advisory lock, so replicas booting together take turns: the first
// applies them and the rest find nothing left to do.
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

/** Any constant shared by every replica; "zeema" in ASCII. */
export const MIGRATION_LOCK = 0x7a65656d61;

// One dedicated connection holds the session-level lock for the whole run: with `max: 1` every
// statement the migrator sends goes over the connection that took the lock.
async function migrateLocked(url: string) {
  const conn = postgres(url, { max: 1, prepare: false, onnotice: () => {} });
  try {
    await conn`select pg_advisory_lock(${MIGRATION_LOCK})`;
    try {
      await migratePostgres(drizzlePostgres(conn, { schema }), { migrationsFolder });
    } finally {
      await conn`select pg_advisory_unlock(${MIGRATION_LOCK})`;
    }
  } finally {
    await conn.end({ timeout: 5 });
  }
}

async function open(): Promise<Db> {
  const url = process.env.DATABASE_URL;
  if (url) {
    await migrateLocked(url);
    const client = postgres(url, { max: 10, prepare: false });
    const db = drizzlePostgres(client, { schema });
    holder.kind = "postgres";
    return db;
  }
  if (process.env.NODE_ENV === "production")
    throw new Error(
      "DATABASE_URL is not set. Production refuses the embedded database; point it at Postgres.",
    );
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
