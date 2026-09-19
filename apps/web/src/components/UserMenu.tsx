"use client";

// The signed-in avatar with its menu: profile and sign-out live here, nowhere else in the bar.
// An account holding the admin role also gets the presence switch: it signs in as a member and
// turns the role on for this session only from here.
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type Props = {
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  isAdmin: boolean;
  actingAdmin: boolean;
};

export function UserMenu({ username, displayName, avatarUrl, isAdmin, actingAdmin }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [broken, setBroken] = useState(false);
  const [busy, setBusy] = useState(false);
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

  const switchMode = async (admin: boolean) => {
    setBusy(true);
    try {
      const res = await fetch("/api/auth/mode", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ admin }),
      });
      if (res.ok) {
        setOpen(false);
        // Leaving admin on an admin-only page: go somewhere a member can be.
        if (!admin && pathname.startsWith("/admin")) router.push("/");
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div ref={root} className={`user-menu${actingAdmin ? " is-admin" : ""}`}>
      <button
        type="button"
        className="avatar-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={actingAdmin ? "Account menu (acting as admin)" : "Account menu"}
        title={actingAdmin ? "Acting as admin" : undefined}
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
        {actingAdmin ? <span className="admin-dot" aria-hidden="true" /> : null}
      </button>
      {open ? (
        <div className="menu" role="menu">
          <div className="menu-head">
            <div className="menu-name">{displayName || username}</div>
            <div className="mono meta">
              @{username}
              {actingAdmin ? <span className="tag tag-accent ml-2">admin</span> : null}
            </div>
          </div>
          <Link
            href={`/u/${username}`}
            role="menuitem"
            className="menu-item no-underline"
            onClick={() => setOpen(false)}
          >
            Profile
          </Link>
          {isAdmin ? (
            <>
              <button
                type="button"
                role="menuitemcheckbox"
                aria-checked={actingAdmin}
                className="menu-item menu-switch"
                disabled={busy}
                onClick={() => void switchMode(!actingAdmin)}
              >
                <span>Act as admin</span>
                <span className={`switch${actingAdmin ? " on" : ""}`} aria-hidden="true" />
              </button>
              {actingAdmin ? (
                <Link
                  href="/admin/iam"
                  role="menuitem"
                  className="menu-item no-underline"
                  onClick={() => setOpen(false)}
                >
                  IAM · roles
                </Link>
              ) : null}
            </>
          ) : null}
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
