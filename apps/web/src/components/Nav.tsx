import Link from "next/link";
import { actingAdmin, currentUser, isAdmin } from "@/lib/auth";
import { unreadCount } from "@/lib/social";
import { Mark } from "./Logo";
import { NavMenu } from "./NavMenu";
import { NavSearch } from "./NavSearch";
import { NavTabs } from "./NavTabs";
import { NewDesignButton } from "./NewDesignButton";
import { NotificationBell } from "./NotificationBell";
import { ThemeToggle } from "./ThemeToggle";
import { UserMenu } from "./UserMenu";

// The site bar, in the canvas's language: a sticky, transparent strip holding two floating
// pills. Left, the mark and the sections as a segmented control; right, search, New design, the
// bell, the theme and the account. On phones the right pill keeps New and the account and the
// rest moves into NavMenu.
export async function Nav() {
  const user = await currentUser();
  // The badge's first value comes with the page; the bell polls from there.
  const unread = user ? await unreadCount(user).catch(() => 0) : 0;
  return (
    <header className="sitebar">
      <div className="pill sitebar-pill">
        <Link href="/" className="wordmark no-underline">
          <Mark size={20} />
          <span className="wordmark-text">Zeema</span>
        </Link>
        <span className="pill-sep sitebar-wide" aria-hidden />
        <NavTabs />
      </div>
      <div className="pill sitebar-pill">
        <NavSearch />
        <NewDesignButton />
        <span className="sitebar-wide sitebar-icons">
          {user ? <NotificationBell initialCount={unread} /> : null}
          <ThemeToggle />
        </span>
        {user ? (
          <UserMenu
            username={user.username}
            displayName={user.displayName}
            avatarUrl={user.avatarUrl}
            isAdmin={isAdmin(user)}
            actingAdmin={actingAdmin(user)}
          />
        ) : (
          <Link href="/signin" className="pill-btn sitebar-signin no-underline">
            Sign in
          </Link>
        )}
        <NavMenu signedIn={Boolean(user)} />
      </div>
    </header>
  );
}
