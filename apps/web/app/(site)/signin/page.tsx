import { redirect } from "next/navigation";
import { GitHub } from "@/components/Glyphs";
import { Mark } from "@/components/Logo";
import { currentUser, githubConfigured } from "@/lib/auth";
import { nextPath } from "@/lib/http-guards";

export const dynamic = "force-dynamic";

export default async function SignIn({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const viewer = await currentUser();
  // Only a path on this site: `//evil.example` and friends become "/" (http-guards.ts).
  const safe = sp.next ? nextPath(sp.next) : null;
  if (viewer) redirect(safe ?? `/u/${viewer.username}`);
  const next = safe && safe !== "/" ? safe : "";
  return (
    <div className="center-stage">
      <div className="center-card signin-card">
        <span className="signin-mark" aria-hidden>
          <Mark size={32} />
        </span>
        <div className="flex flex-col gap-1">
          <h1 className="signin-title">Zeema</h1>
          <p className="muted">Architecture as typed, queryable data.</p>
        </div>
        {sp.error ? <p className="status status-err">sign-in failed: {sp.error}</p> : null}
        {githubConfigured() ? (
          <a
            className="btn btn-primary signin-btn no-underline"
            href={`/api/auth/github${next ? `?next=${encodeURIComponent(next)}` : ""}`}
          >
            <GitHub />
            Continue with GitHub
          </a>
        ) : (
          <p className="empty small">
            GitHub sign-in is not configured on this server. Set <code>GITHUB_CLIENT_ID</code> and{" "}
            <code>GITHUB_CLIENT_SECRET</code>.
          </p>
        )}
        <p className="meta signin-note">
          Reading is open to everyone. Creating, cloning and publishing designs needs an account,
          and the account is your GitHub identity. Zeema never sees a password.
        </p>
      </div>
    </div>
  );
}
