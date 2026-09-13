"use client";

// The signed-in avatar with its menu: profile and sign-out live here, nowhere else in the bar.
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type Props = { username: string; displayName: string | null; avatarUrl: string | null };

export function UserMenu({ username, displayName, avatarUrl }: Props) {
  const [open, setOpen] = useState(false);
  const [broken, setBroken] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  const initial = (displayName || username).trim().charAt(0).toUpperCase() || "?";
  return (
    <div ref={root} className="user-menu">
      <button
        type="button"
        className="avatar-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        onClick={() => setOpen((o) => !o)}
      >
        {avatarUrl && !broken ? (
          <img
            src={avatarUrl}
            alt=""
            width={28}
            height={28}
            className="avatar"
            onError={() => setBroken(true)}
          />
        ) : (
          <span className="avatar avatar-fallback" aria-hidden="true">
            {initial}
          </span>
        )}
      </button>
      {open ? (
        <div className="menu" role="menu">
          <div className="menu-head">
            <div className="menu-name">{displayName || username}</div>
            <div className="mono meta">@{username}</div>
          </div>
          <Link
            href={`/u/${username}`}
            role="menuitem"
            className="menu-item no-underline"
            onClick={() => setOpen(false)}
          >
            Profile
          </Link>
          <form action="/api/auth/logout" method="post">
            <button type="submit" role="menuitem" className="menu-item">
              Sign out
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
