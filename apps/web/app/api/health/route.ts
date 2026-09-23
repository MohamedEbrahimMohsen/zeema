// Liveness and readiness in one endpoint. The process answering at all is liveness; the
// database round trip is readiness. Container orchestration reads the status code, a human
// reads the body. The body says what state the database is in and never why: the error text
// (host names, user names, auth posture) goes to the server log, not to anonymous callers.
import { getDb } from "@/db";
import { databaseConfigured } from "@/lib/boot";

export const dynamic = "force-dynamic";

export async function GET() {
  let database: "ok" | "unreachable" | "not configured" = "ok";
  if (!databaseConfigured()) database = "not configured";
  else
    try {
      const db = await getDb();
      await db.execute("select 1");
    } catch (e) {
      database = "unreachable";
      console.error("[health] database check failed:", (e as Error).message);
    }
  const ready = database === "ok";
  return Response.json(
    { status: ready ? "ok" : "degraded", database },
    { status: ready ? 200 : 503, headers: { "cache-control": "no-store" } },
  );
}
