import type { NextRequest } from "next/server";
import { handle, json, readJson, viewerOf } from "@/lib/api";
import { grantRole, revokeRole } from "@/lib/iam";

type Body = { username: string; role: string; note?: string };

/** Grant a role: {username, role, note?}. Idempotent. */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const body = await readJson<Body>(req);
    const { grant, created } = await grantRole(await viewerOf(), body);
    return json({ grant, created }, { status: created ? 201 : 200 });
  });
}

/** Revoke a role: {username, role}. */
export async function DELETE(req: NextRequest) {
  return handle(async () => {
    const body = await readJson<Body>(req);
    const result = await revokeRole(await viewerOf(), body);
    return json(result);
  });
}
