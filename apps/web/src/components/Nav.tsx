import Link from "next/link";
import { actingAdmin, currentUser, isAdmin } from "@/lib/auth";
import { Mark } from "./Logo";
import { NavTabs } from "./NavTabs";
import { ThemeToggle } from "./ThemeToggle";
import { UserMenu } from "./UserMenu";

export async function Nav() {
  const user = await currentUser();
  return (
    <header className="topbar">
      <Link href="/" className="wordmark no-underline">
        <Mark size={20} />
        Zeema
      </Link>
      <NavTabs />
      <div className="ml-auto flex items-center gap-3">
        <ThemeToggle />
        <Link href="/new" className="btn btn-sm no-underline">
          New design
        </Link>
        {user ? (
          <UserMenu
            username={user.username}
            displayName={user.displayName}
            avatarUrl={user.avatarUrl}
            isAdmin={isAdmin(user)}
            actingAdmin={actingAdmin(user)}
          />
        ) : (
          <Link href="/signin" className="btn btn-primary btn-sm no-underline">
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}
