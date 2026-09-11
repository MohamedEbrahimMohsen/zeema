import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { NavTabs } from "./NavTabs";
import { ThemeToggle } from "./ThemeToggle";

export async function Nav() {
  const user = await currentUser();
  return (
    <header className="topbar">
      <Link href="/" className="wordmark no-underline">
        Arkore
      </Link>
      <NavTabs />
      <div className="ml-auto flex items-center gap-3">
        <ThemeToggle />
        {user ? (
          <>
            <Link href="/new" className="btn btn-primary btn-sm no-underline">
              New design
            </Link>
            <Link
              href={`/u/${user.username}`}
              className="small flex items-center gap-2 no-underline"
            >
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt="" width={22} height={22} className="avatar" />
              ) : null}
              <span className="mono">{user.username}</span>
            </Link>
            <form action="/api/auth/logout" method="post">
              <button type="submit" className="btn btn-ghost btn-sm">
                Sign out
              </button>
            </form>
          </>
        ) : (
          <Link href="/signin" className="btn btn-primary btn-sm no-underline">
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}
