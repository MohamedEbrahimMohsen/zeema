"use client";

// New design as a split action: the button itself still opens an empty canvas (/new), and the
// chevron beside it offers the other way in, importing a design that left the site as files
// (/new/import). Same keyboard and dismissal as the other menus (menu-keys).
import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { useMenuKeys } from "./menu-keys";

const CHEVRON = (
  <svg
    viewBox="0 0 16 16"
    width="12"
    height="12"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M4 6l4 4 4-4" />
  </svg>
);

export function NewDesignButton() {
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
    <div ref={root} className="new-split">
      <Link href="/new" className="btn btn-primary btn-sm no-underline new-split-main">
        New design
      </Link>
      <button
        ref={button}
        type="button"
        className="btn btn-primary btn-sm new-split-more"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="More ways to start a design"
        title="More ways to start a design"
        onClick={() => setOpen((o) => !o)}
      >
        {CHEVRON}
      </button>
      {open ? (
        <div ref={menu} className="menu new-split-menu" role="menu" onKeyDown={onMenuKey}>
          <Link
            href="/new/import"
            role="menuitem"
            className="menu-item no-underline"
            onClick={() => setOpen(false)}
          >
            Import YAML…
          </Link>
        </div>
      ) : null}
    </div>
  );
}
