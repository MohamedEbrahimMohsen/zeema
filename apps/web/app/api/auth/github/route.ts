// Start the GitHub OAuth flow: state in a short-lived cookie, minimal scope.
import { GitHub, generateState } from "arctic";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { githubConfigured } from "@/lib/auth";
import { appOrigin, nextPath, redirectTo } from "@/lib/http-guards";

export async function GET(req: Request) {
  if (!githubConfigured())
    return NextResponse.redirect(redirectTo(req, "/signin?error=github-not-configured"));
  const origin = appOrigin() ?? new URL(req.url).origin;
  const github = new GitHub(
    process.env.GITHUB_CLIENT_ID!,
    process.env.GITHUB_CLIENT_SECRET!,
    `${origin}/api/auth/github/callback`,
  );
  const state = generateState();
  const url = github.createAuthorizationURL(state, ["read:user"]);
  const jar = await cookies();
  jar.set("zeema_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });
  // Checked before it is stored, and again when the callback reads it back.
  const raw = new URL(req.url).searchParams.get("next");
  const next = raw ? nextPath(raw) : null;
  if (next && next !== "/")
    jar.set("zeema_oauth_next", next, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 600,
    });
  return NextResponse.redirect(url);
}
