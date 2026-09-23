// Switch this session between member and admin presence. Only an account holding the admin
// role can switch on; anyone can switch off. Accepts JSON {admin} or a form field.
import { NextResponse } from "next/server";
import { handle, json, viewerOf } from "@/lib/api";
import { setActingAdmin } from "@/lib/auth";
import { ServiceError } from "@/lib/designs";
import { nextPath } from "@/lib/http-guards";

export async function POST(req: Request) {
  return handle(async () => {
    const viewer = await viewerOf();
    if (!viewer) throw new ServiceError(401, "not signed in");
    const type = req.headers.get("content-type") ?? "";
    let on: boolean;
    let next: string | null = null;
    if (type.includes("json")) {
      const body = (await req.json().catch(() => ({}))) as { admin?: unknown };
      on = body.admin === true || body.admin === "on";
    } else {
      const form = await req.formData();
      on = form.get("admin") === "on";
      next = String(form.get("next") ?? "");
    }
    const ok = await setActingAdmin(viewer, on);
    if (!ok) throw new ServiceError(403, "this account does not hold the admin role");
    if (next) return NextResponse.redirect(new URL(nextPath(next), req.url), { status: 303 });
    return json({ actingAdmin: on });
  });
}
