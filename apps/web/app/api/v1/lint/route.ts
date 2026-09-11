// Lint a design text without storing it: the editor's live findings and the same answer the
// storage gate gives.
import type { NextRequest } from "next/server";
import { clientIp, handle, json, rateLimit, readJson, viewerOf } from "@/lib/api";
import { getCatalogue } from "@/lib/catalogue";
import { ServiceError } from "@/lib/designs";
import { analyse } from "@/lib/lint";

export async function POST(req: NextRequest) {
  return handle(async () => {
    const viewer = await viewerOf();
    rateLimit(`lint:${viewer?.id ?? clientIp(req)}`, 300);
    const body = await readJson<{ yaml: string }>(req);
    if (typeof body.yaml !== "string") throw new ServiceError(400, "yaml must be text");
    const { doc, findings } = analyse(body.yaml, getCatalogue());
    return json({
      valid: Boolean(doc) && !findings.some((f) => f.blocking),
      findings,
      counts: {
        nodes: doc?.nodes.length ?? 0,
        edges: doc?.edges.length ?? 0,
        groups: doc?.groups?.length ?? 0,
      },
    });
  });
}
