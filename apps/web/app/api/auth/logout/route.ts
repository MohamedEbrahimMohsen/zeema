import { NextResponse } from "next/server";
import { clearSessionCookie, revokeCurrentSession } from "@/lib/auth";

export async function POST(req: Request) {
  await revokeCurrentSession();
  await clearSessionCookie();
  return NextResponse.redirect(new URL("/", req.url), { status: 303 });
}
