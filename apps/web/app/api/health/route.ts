// Liveness and readiness in one endpoint. The process answering at all is liveness; the
// database round trip is readiness. Container orchestration reads the status code, a human
// reads the body.
import { getDb } from "@/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const started = process.uptime();
  let database: "ok" | "unreachable" = "ok";
  let error: string | undefined;
  try {
    const db = await getDb();
    await db.execute("select 1");
  } catch (e) {
    database = "unreachable";
    error = (e as Error).message;
  }
  const ready = database === "ok";
  return Response.json(
    { status: ready ? "ok" : "degraded", database, error, uptimeSeconds: Math.round(started) },
    { status: ready ? 200 : 503, headers: { "cache-control": "no-store" } },
  );
}
