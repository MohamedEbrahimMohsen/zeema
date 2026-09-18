import type { NextRequest } from "next/server";
import { handle, json, viewerOf } from "@/lib/api";
import { listUsers } from "@/lib/iam";

/** Users and their roles (acting admin only). ?q= filters, ?admins=1 keeps only admins. */
export async function GET(req: NextRequest) {
  return handle(async () => {
    const p = req.nextUrl.searchParams;
    const users = await listUsers(await viewerOf(), {
      q: p.get("q") ?? undefined,
      onlyAdmins: p.get("admins") === "1",
    });
    return json({ users });
  });
}
