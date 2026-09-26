"use client";

// The phone nav: below 640px the tabs, the theme switch and the bell leave the bar, and this
// button opens them as a dropdown card under it. Same keyboard as the other menus (menu-keys).
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { useMenuKeys } from "./menu-keys";
import { isActive, TABS } from "./NavTabs";
import { ThemeToggle } from "./ThemeToggle";

const BARS = (
  <svg
    viewBox="0 0 24 24"
    width="16"
    height="16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    aria-hidden="true"
  >
    <path d="M4 7h16M4 12h16M4 17h16" />
  </svg>
);

export function NavMenu({ signedIn }: { signedIn: boolean }) {
  const path = usePathname() ?? "/";
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const close = useCallback((refocus: boolean) => {
    setOpen(false);
    if (refocus) button.current?.focus();
  }, []);
  const onMenuKey = useMenuKeys({ open, close, root, menu });

  return (
    <div ref={root} className="nav-menu">
      <button
        ref={button}
        type="button"
        className="icon-btn nav-menu-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Menu"
        title="Menu"
        onClick={() => setOpen((o) => !o)}
      >
        {BARS}
      </button>
      {open ? (
        <div ref={menu} className="menu nav-menu-card" role="menu" onKeyDown={onMenuKey}>
          {TABS.map(([href, label]) => {
            const on = isActive(path, href);
            return (
              <Link
                key={href}
                href={href}
                role="menuitem"
                aria-current={on ? "page" : undefined}
                className={`menu-item no-underline${on ? " is-current" : ""}`}
                onClick={() => setOpen(false)}
              >
                {label}
              </Link>
            );
          })}
          <div className="menu-sep" />
          {signedIn ? (
            <Link
              href="/notifications"
              role="menuitem"
              className="menu-item no-underline"
              onClick={() => setOpen(false)}
            >
              Notifications
            </Link>
          ) : null}
          <ThemeToggle variant="menu" />
        </div>
      ) : null}
    </div>
  );
}
