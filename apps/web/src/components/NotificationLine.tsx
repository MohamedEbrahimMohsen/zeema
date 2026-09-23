// One notification as a line of text, shared by the bell's panel and the /notifications page.
// No hooks and no server imports, so both a client and a server component can render it.
import type { NotificationKind } from "@/db/schema";

export type NotificationView = {
  id: string;
  kind: NotificationKind;
  createdAt: string | Date;
  read: boolean;
  actor: { username: string; displayName: string | null; avatarUrl: string | null } | null;
  design: { title: string; address: string } | null;
};

const VERB: Record<NotificationKind, string> = {
  design_cloned: "cloned",
  design_published_by_followed: "published",
  design_findings_changed: "has new findings on",
  design_renamed_link: "renamed",
};

/** "3m ago", "5h ago", "4d ago", then the date. */
export function relativeTime(at: string | Date, now = Date.now()) {
  const t = new Date(at).getTime();
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86_400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 30 * 86_400) return `${Math.floor(s / 86_400)}d ago`;
  return new Date(at).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** The sentence: "@alice cloned YouTube copy". Plain text for titles and labels. */
export function notificationText(n: NotificationView) {
  const who = n.actor ? `@${n.actor.username}` : "Someone";
  return `${who} ${VERB[n.kind]} ${n.design?.title ?? "a design that is no longer available"}`;
}

export function NotificationLine({ n }: { n: NotificationView }) {
  return (
    <span className="notif-text">
      {n.actor ? <strong>@{n.actor.username}</strong> : <strong>Someone</strong>} {VERB[n.kind]}{" "}
      {n.design ? (
        <em>{n.design.title}</em>
      ) : (
        <em className="muted">a design no longer available</em>
      )}
    </span>
  );
}
