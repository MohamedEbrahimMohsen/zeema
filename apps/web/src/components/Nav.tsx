import Link from "next/link";
import { currentUser } from "@/lib/auth";

export async function Nav() {
  const user = await currentUser();
  return (
    <header className="border-b" style={{ borderColor: "var(--line)", background: "var(--panel)" }}>
      <div className="mx-auto flex max-w-6xl items-center gap-5 px-4 py-3">
        <Link href="/" className="text-lg font-semibold tracking-tight no-underline">
          Arkore
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/browse" className="no-underline">
            Browse
          </Link>
          <Link href="/catalogue" className="no-underline">
            Catalogue
          </Link>
          <Link href="/docs" className="no-underline">
            Docs
          </Link>
        </nav>
        <div className="ml-auto flex items-center gap-3 text-sm">
          {user ? (
            <>
              <Link href="/new" className="btn btn-primary no-underline">
                New design
              </Link>
              <Link href={`/u/${user.username}`} className="flex items-center gap-2 no-underline">
                {user.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt=""
                    width={24}
                    height={24}
                    className="rounded-full"
                  />
                ) : null}
                <span>{user.username}</span>
              </Link>
              <form action="/api/auth/logout" method="post">
                <button type="submit" className="btn">
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <Link href="/signin" className="btn btn-primary no-underline">
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
