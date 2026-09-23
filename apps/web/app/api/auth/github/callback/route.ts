// Exchange the code, fetch the profile, upsert the user, open a session. The access token is
// used for the profile fetch and then dropped.
import { GitHub } from "arctic";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  bootstrapAdmin,
  createSession,
  githubConfigured,
  setSessionCookie,
  upsertGithubUser,
} from "@/lib/auth";
import { nextPath } from "@/lib/http-guards";
import { countSignin } from "@/lib/metrics";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const fail = (why: string) => {
    countSignin("failed");
    return NextResponse.redirect(new URL(`/signin?error=${encodeURIComponent(why)}`, req.url));
  };
  if (!githubConfigured()) return fail("github-not-configured");
  const jar = await cookies();
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const saved = jar.get("zeema_oauth_state")?.value;
  jar.delete("zeema_oauth_state");
  if (!code || !state || !saved || state !== saved) return fail("state-mismatch");
  const origin = process.env.APP_ORIGIN ?? url.origin;
  const github = new GitHub(
    process.env.GITHUB_CLIENT_ID!,
    process.env.GITHUB_CLIENT_SECRET!,
    `${origin}/api/auth/github/callback`,
  );
  let accessToken: string;
  try {
    const tokens = await github.validateAuthorizationCode(code);
    accessToken = tokens.accessToken();
  } catch {
    return fail("code-exchange-failed");
  }
  const res = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "User-Agent": "zeema",
      Accept: "application/vnd.github+json",
    },
  });
  if (!res.ok) return fail("profile-fetch-failed");
  const profile = (await res.json()) as {
    id: number;
    login: string;
    name?: string | null;
    avatar_url?: string | null;
    bio?: string | null;
  };
  const user = await upsertGithubUser(profile);
  await bootstrapAdmin(user);
  const { token, expiresAt } = await createSession(user.id);
  countSignin("ok");
  await setSessionCookie(token, expiresAt);
  const next = jar.get("zeema_oauth_next")?.value;
  jar.delete("zeema_oauth_next");
  return NextResponse.redirect(new URL(next ? nextPath(next) : `/u/${user.username}`, req.url));
}
