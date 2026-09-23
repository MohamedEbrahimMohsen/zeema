"use client";

// The bell in the top bar, signed-in only. The badge is the unread count, polled once a minute
// while the tab is visible (no websockets); opening the panel loads the latest ten and marks the
// unread ones on screen read after two seconds, so a glance at the list counts as reading it and
// a hover does not. Same visual language as the account menu.
import Link from "next/link";
import { type CSSProperties, useCallback, useEffect, useRef, useState } from "react";
import { NotificationLine, type NotificationView, relativeTime } from "./NotificationLine";

const POLL_MS = 60_000;
const READ_AFTER_MS = 2_000;
const SHOWN = 10;

const BELL = (
  <svg
    viewBox="0 0 24 24"
    width="16"
    height="16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </svg>
);

export const badgeLabel = (n: number) => (n > 99 ? "99+" : String(n));

async function postRead(body: { ids: string[] } | { all: true }) {
  const res = await fetch("/api/v1/notifications/read", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.ok;
}

export function NotificationBell({ initialCount }: { initialCount: number }) {
  const [count, setCount] = useState(initialCount);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationView[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [top, setTop] = useState<number | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const stopped = useRef(false);

  const refreshCount = useCallback(async () => {
    if (stopped.current) return;
    try {
      const res = await fetch("/api/v1/notifications/unread-count", { cache: "no-store" });
      // Signed out elsewhere: stop asking until the next page load.
      if (res.status === 401) {
        stopped.current = true;
        return;
      }
      if (res.ok) setCount(((await res.json()) as { count: number }).count);
    } catch {}
  }, []);

  // Poll while the tab is visible; catch up at once when it becomes visible again.
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") void refreshCount();
    };
    const timer = window.setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [refreshCount]);

  const close = useCallback((refocus: boolean) => {
    setOpen(false);
    if (refocus) button.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) close(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(true);
    };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open, close]);

  // Load the latest ten each time the panel opens.
  useEffect(() => {
    if (!open) return;
    let live = true;
    setFailed(false);
    fetch(`/api/v1/notifications?pageSize=${SHOWN}`, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        const body = (await res.json()) as { items: NotificationView[]; unread: number };
        if (!live) return;
        setItems(body.items);
        setCount(body.unread);
      })
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [open]);

  // Two seconds with the panel open and the list on screen marks what is shown read.
  useEffect(() => {
    if (!open || !items) return;
    const unread = items.filter((n) => !n.read).map((n) => n.id);
    if (!unread.length) return;
    const timer = window.setTimeout(async () => {
      if (await postRead({ ids: unread })) {
        setItems(
          (cur) => cur?.map((n) => (unread.includes(n.id) ? { ...n, read: true } : n)) ?? cur,
        );
        setCount((c) => Math.max(0, c - unread.length));
      }
    }, READ_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, [open, items]);

  const markAll = async () => {
    if (await postRead({ all: true })) {
      setItems((cur) => cur?.map((n) => ({ ...n, read: true })) ?? cur);
      setCount(0);
    }
  };

  const toggle = () => {
    if (!open && button.current) setTop(button.current.getBoundingClientRect().bottom + 6);
    setOpen((o) => !o);
  };

  const label = count ? `Notifications, ${badgeLabel(count)} unread` : "Notifications";
  return (
    <div ref={root} className="notif">
      <button
        ref={button}
        type="button"
        className="icon-btn notif-btn"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls="notif-panel"
        aria-label={label}
        title={label}
        onClick={toggle}
      >
        {BELL}
        {count > 0 ? (
          <span className="notif-badge" aria-hidden="true">
            {badgeLabel(count)}
          </span>
        ) : null}
      </button>
      <span className="sr-only" aria-live="polite">
        {count ? `${badgeLabel(count)} unread notifications` : ""}
      </span>
      {open ? (
        <div
          id="notif-panel"
          className="menu notif-menu"
          role="dialog"
          aria-label="Notifications"
          style={top === null ? undefined : ({ "--notif-top": `${top}px` } as CSSProperties)}
        >
          <div className="notif-head">
            <span className="menu-name">Notifications</span>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => void markAll()}
              disabled={!items?.some((n) => !n.read) && count === 0}
            >
              Mark all read
            </button>
          </div>
          {failed ? (
            <p className="notif-empty small muted">Could not load notifications.</p>
          ) : items === null ? (
            <p className="notif-empty small muted">Loading…</p>
          ) : items.length === 0 ? (
            <p className="notif-empty small muted">Nothing yet.</p>
          ) : (
            <ul className="notif-list">
              {items.map((n) => (
                <li key={n.id} className="notif-li">
                  <NotificationRow n={n} onFollow={() => close(false)} />
                </li>
              ))}
            </ul>
          )}
          <Link
            href="/notifications"
            className="menu-item notif-all no-underline"
            onClick={() => close(false)}
          >
            See all notifications
          </Link>
        </div>
      ) : null}
    </div>
  );
}

function NotificationRow({ n, onFollow }: { n: NotificationView; onFollow: () => void }) {
  const body = (
    <>
      <NotifAvatar n={n} />
      <span className="notif-main">
        <NotificationLine n={n} />
        <time className="meta" dateTime={new Date(n.createdAt).toISOString()}>
          {relativeTime(n.createdAt)}
        </time>
      </span>
      {n.read ? null : <span className="notif-dot" role="img" aria-label="unread" />}
    </>
  );
  return n.design ? (
    <Link href={n.design.address} className="notif-item no-underline" onClick={onFollow}>
      {body}
    </Link>
  ) : (
    <div className="notif-item">{body}</div>
  );
}

function NotifAvatar({ n }: { n: NotificationView }) {
  const a = n.actor;
  const [broken, setBroken] = useState(false);
  if (a?.avatarUrl && !broken)
    return (
      <img
        src={a.avatarUrl}
        alt=""
        width={28}
        height={28}
        className="avatar"
        onError={() => setBroken(true)}
      />
    );
  return (
    <span className="avatar avatar-fallback" aria-hidden="true">
      {(a?.displayName || a?.username || "?").trim().charAt(0).toUpperCase()}
    </span>
  );
}
