import Link from "next/link";
import { actingAdmin, currentUser, isAdmin } from "@/lib/auth";
import { unreadCount } from "@/lib/social";
import { Mark } from "./Logo";
import { NavTabs } from "./NavTabs";
import { NotificationBell } from "./NotificationBell";
import { ThemeToggle } from "./ThemeToggle";
import { UserMenu } from "./UserMenu";

export async function Nav() {
  const user = await currentUser();
  // The badge's first value comes with the page; the bell polls from there.
  const unread = user ? await unreadCount(user).catch(() => 0) : 0;
  return (
    <header className="topbar">
      <Link href="/" className="wordmark no-underline">
        <Mark size={20} />
        <span className="wordmark-text">Zeema</span>
      </Link>
      <NavTabs />
      <div className="ml-auto flex items-center gap-3">
        <ThemeToggle />
        {user ? <NotificationBell initialCount={unread} /> : null}
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
