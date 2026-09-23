// Configuration a production server refuses to start without. Checked from instrumentation.ts
// at boot, and again where each value is used, so a missing variable is a loud failure rather
// than a site that works until its container restarts.

type Env = Record<string, string | undefined>;

const isProduction = (env: Env) => env.NODE_ENV === "production";

/** Placeholder salts: the compose default of old and the .env.example value. */
const WEAK_SALTS = new Set(["", "zeema", "change-me"]);

/** Whether this process has a database it may use: Postgres, or PGlite outside production. */
export const databaseConfigured = (env: Env = process.env) =>
  Boolean(env.DATABASE_URL) || !isProduction(env);

/** The salt for hashed addresses in the event log. Throws in production when it is a placeholder. */
export function eventSalt(env: Env = process.env): string {
  const salt = env.EVENT_SALT ?? "";
  if (WEAK_SALTS.has(salt)) {
    if (isProduction(env))
      throw new Error("EVENT_SALT must be set to a random value in production");
    return "zeema-dev";
  }
  return salt;
}

/** Every refusal at once, so one restart shows the whole list. */
export function bootProblems(env: Env = process.env): string[] {
  if (!isProduction(env)) return [];
  const problems: string[] = [];
  if (!env.DATABASE_URL)
    problems.push(
      "DATABASE_URL is not set. Production does not fall back to the embedded database: its data would vanish on the next restart.",
    );
  if (WEAK_SALTS.has(env.EVENT_SALT ?? ""))
    problems.push("EVENT_SALT is unset or a placeholder. Generate one: openssl rand -hex 24");
  return problems;
}
