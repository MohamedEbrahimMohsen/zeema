import Link from "next/link";
import { redirect } from "next/navigation";
import { MarkAllRead } from "@/components/MarkAllRead";
import { NotificationLine, relativeTime } from "@/components/NotificationLine";
import { Pager } from "@/components/Pager";
import { UserAvatar } from "@/components/UserAvatar";
import { currentUser } from "@/lib/auth";
import { intParam } from "@/lib/http-guards";
import { listNotifications, NOTIFICATION_RETENTION_DAYS } from "@/lib/social";

export const dynamic = "force-dynamic";

export default async function Notifications({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; unread?: string }>;
}) {
  const sp = await searchParams;
  const viewer = await currentUser();
  if (!viewer) redirect("/signin?next=/notifications");
  const unreadOnly = sp.unread === "1";
  const page = intParam(sp.page, { fallback: 1, min: 1, max: 10_000 });
  const result = await listNotifications(viewer, { page, unreadOnly });
  const href = (p: number, unread = unreadOnly) => {
    const q = new URLSearchParams();
    if (unread) q.set("unread", "1");
    if (p > 1) q.set("page", String(p));
    const s = q.toString();
    return s ? `/notifications?${s}` : "/notifications";
  };
  return (
    <div className="flex flex-col gap-4" style={{ maxWidth: 720 }}>
      <div className="flex flex-wrap items-baseline gap-3">
        <h1 className="display">Notifications</h1>
        <span className="label">{result.unread} unread</span>
        <div className="ml-auto flex items-center gap-2">
          <nav className="tabs" aria-label="Filter">
            <Link
              href={href(1, false)}
              className={`tab${unreadOnly ? "" : " active"}`}
              aria-current={unreadOnly ? undefined : "page"}
            >
              All
            </Link>
            <Link
              href={href(1, true)}
              className={`tab${unreadOnly ? " active" : ""}`}
              aria-current={unreadOnly ? "page" : undefined}
            >
              Unread
            </Link>
          </nav>
          <MarkAllRead disabled={result.unread === 0} />
        </div>
      </div>
      {result.items.length === 0 ? (
        <div className="empty">{unreadOnly ? "Nothing unread." : "No notifications yet."}</div>
      ) : (
        <ul className="list notif-page">
          {result.items.map((n) => {
            const body = (
              <>
                {n.actor ? (
                  <UserAvatar user={n.actor} size={28} />
                ) : (
                  <span className="avatar avatar-fallback" aria-hidden="true">
                    ?
                  </span>
                )}
                <span className="notif-main">
                  <NotificationLine n={n} />
                  <time className="meta" dateTime={n.createdAt.toISOString()}>
                    {relativeTime(n.createdAt)}
                  </time>
                </span>
                {n.read ? null : <span className="notif-dot" role="img" aria-label="unread" />}
              </>
            );
            return (
              <li key={n.id} className="notif-li">
                {n.design ? (
                  <Link href={n.design.address} className="notif-item no-underline">
                    {body}
                  </Link>
                ) : (
                  <div className="notif-item">{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <Pager page={result.page} total={result.total} pageSize={result.pageSize} href={href} />
      <p className="small muted">
        Notifications are kept for {NOTIFICATION_RETENTION_DAYS} days.{" "}
        <Link href="/docs/profiles-and-notifications" className="link">
          What sends one
        </Link>
        .
      </p>
    </div>
  );
}
