import { redirect } from "next/navigation";
import { Mark } from "@/components/Logo";
import { currentUser, githubConfigured } from "@/lib/auth";

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
    <div className="mx-auto max-w-sm py-6">
      <div className="panel p-6 flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <span className="wordmark">
            <Mark size={24} />
            Zeema
          </span>
          <span className="small muted">Architecture as typed, queryable data.</span>
        </div>
        <p className="small muted">
          Reading is open to everyone. Creating, cloning and publishing designs needs an account,
          and the account is your GitHub identity. Zeema never sees a password.
        </p>
        {sp.error ? <p className="status status-err">sign-in failed: {sp.error}</p> : null}
        {githubConfigured() ? (
          <a
            className="btn btn-primary no-underline"
            href={`/api/auth/github${next ? `?next=${encodeURIComponent(next)}` : ""}`}
          >
            Continue with GitHub
          </a>
        ) : (
          <p className="empty small">
            GitHub sign-in is not configured on this server. Set <code>GITHUB_CLIENT_ID</code> and{" "}
            <code>GITHUB_CLIENT_SECRET</code>.
          </p>
        )}
      </div>
    </div>
  );
}
