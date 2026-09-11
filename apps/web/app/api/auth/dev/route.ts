// Development sign-in: only outside production and only with AUTH_DEV_LOGIN=1. Creates or
// reuses a local account so the platform can be exercised before a GitHub OAuth app exists.
import { NextResponse } from "next/server";
import { createSession, devLoginEnabled, setSessionCookie, upsertGithubUser } from "@/lib/auth";

export async function POST(req: Request) {
  if (!devLoginEnabled())
    return NextResponse.json({ error: { code: 404, message: "not found" } }, { status: 404 });
  const form = await req.formData();
  const login =
    String(form.get("login") ?? "dev")
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-") || "dev";
  const id = 1_000_000 + [...login].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 1_000_000, 7);
  const user = await upsertGithubUser({
    id,
    login,
    name: `${login} (local)`,
    avatar_url: null,
    bio: "Local development account",
  });
  const { token, expiresAt } = await createSession(user.id);
  await setSessionCookie(token, expiresAt);
  return NextResponse.redirect(new URL(`/u/${user.username}`, req.url), { status: 303 });
}
