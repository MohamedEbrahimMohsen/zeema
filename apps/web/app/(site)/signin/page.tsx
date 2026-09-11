import { redirect } from "next/navigation";
import { currentUser, devLoginEnabled, githubConfigured } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function SignIn({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const viewer = await currentUser();
  if (viewer) redirect(sp.next?.startsWith("/") ? sp.next : `/u/${viewer.username}`);
  const next = sp.next?.startsWith("/") ? sp.next : "";
  return (
    <div className="mx-auto max-w-md space-y-4">
      <h1 className="text-2xl font-semibold">Sign in</h1>
      <p className="muted text-sm">
        Reading is open to everyone. Creating, cloning and publishing designs needs an account, and
        the account is your GitHub identity. Arkore never sees a password.
      </p>
      {sp.error ? <p className="sev-error text-sm">Sign-in failed: {sp.error}</p> : null}
      {githubConfigured() ? (
        <a
          className="btn btn-primary w-full justify-center no-underline"
          href={`/api/auth/github${next ? `?next=${encodeURIComponent(next)}` : ""}`}
        >
          Continue with GitHub
        </a>
      ) : (
        <p className="panel p-3 text-sm">
          GitHub sign-in is not configured on this server. Set GITHUB_CLIENT_ID and
          GITHUB_CLIENT_SECRET.
        </p>
      )}
      {devLoginEnabled() ? (
        <form action="/api/auth/dev" method="post" className="panel space-y-2 p-3 text-sm">
          <div className="font-medium">Local development account</div>
          <input className="input" name="login" defaultValue="dev" placeholder="username" />
          <button type="submit" className="btn w-full justify-center">
            Sign in locally
          </button>
        </form>
      ) : null}
    </div>
  );
}
