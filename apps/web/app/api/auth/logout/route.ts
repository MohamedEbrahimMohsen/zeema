// Sign out. A form field `scope=all` (the account menu's "Sign out everywhere") revokes every
// session the account holds, for when a cookie may have been copied off another machine.
import { NextResponse } from "next/server";
import {
  clearSessionCookie,
  currentUser,
  revokeAllSessions,
  revokeCurrentSession,
} from "@/lib/auth";
import { redirectTo } from "@/lib/http-guards";

export async function POST(req: Request) {
  const type = req.headers.get("content-type") ?? "";
  const form =
    type.includes("form-data") || type.includes("x-www-form-urlencoded")
      ? await req.formData().catch(() => null)
      : null;
  if (form?.get("scope") === "all") {
    const viewer = await currentUser();
    if (viewer) await revokeAllSessions(viewer.id);
  }
  await revokeCurrentSession();
  await clearSessionCookie();
  return NextResponse.redirect(redirectTo(req, "/"), { status: 303 });
}
