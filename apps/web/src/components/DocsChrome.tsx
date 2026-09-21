"use client";

// The frame around a documentation page: the sidebar, the filter over it, the drawer that
// sidebar becomes on a narrow screen, and the breadcrumb row above the content.
//
// The article itself is server-rendered and arrives as `children`, so none of the prose, the code
// blocks or the generated tables cross into the browser bundle. What is here is only the part
// that has to react to a pointer or a key: opening the drawer, filtering the tree, and moving the
// selection with the arrow keys.
//
// Keyboard: "/" or Ctrl+K (Cmd+K) focuses the filter from anywhere on the page, Escape clears it
// and closes the drawer, Up and Down walk the results and Enter opens the highlighted one.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Close, Menu, Search } from "@/components/Glyphs";
import type { DocNav } from "@/lib/docs";

export type SearchRow = { href: string; title: string; page: string; section: string };

const isTypingTarget = (el: EventTarget | null) => {
  const t = el as HTMLElement | null;
  if (!t) return false;
  const tag = t.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || t.isContentEditable;
};

export function DocsChrome({
  nav,
  index,
  current,
  crumbs,
  rail,
  children,
}: {
  nav: DocNav;
  index: SearchRow[];
  current: string;
  crumbs: Array<{ label: string; href: string | null }>;
  /** The "On this page" rail. A grid child of the shell, so the layout can move it. */
  rail: ReactNode;
  children: ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return index
      .filter((r) => `${r.title} ${r.page} ${r.section}`.toLowerCase().includes(q))
      .slice(0, 12);
  }, [index, query]);

  // The highlighted row, kept inside the current result list without an effect: a filter that
  // shortens the list moves the highlight rather than pointing it past the end.
  const active = results.length ? cursor % results.length : 0;

  const focusFilter = useCallback(() => {
    setOpen(true);
    // The drawer has to exist before the field inside it can take focus.
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setQuery("");
        return;
      }
      if (isTypingTarget(e.target)) return;
      if (e.key === "/" || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k")) {
        e.preventDefault();
        focusFilter();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focusFilter]);

  const go = (href: string) => {
    setQuery("");
    setOpen(false);
    router.push(href);
  };

  const onFieldKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!results.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => (c + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => (c - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(results[active].href);
    }
  };

  return (
    <div className={`docs${open ? " drawer-open" : ""}`}>
      <a className="skip-link" href="#doc-content">
        Skip to content
      </a>

      {/* The pointer affordance for closing the drawer. Escape does the same from the keyboard,
          which is why this carries no role of its own. */}
      <div className="docs-scrim" onClick={() => setOpen(false)} aria-hidden="true" />

      <nav className="docs-side" aria-label="Documentation">
        <div className="docs-side-top">
          <span className="label">Documentation</span>
          <button
            type="button"
            className="btn-icon docs-close"
            onClick={() => setOpen(false)}
            aria-label="Close the documentation menu"
          >
            <Close />
          </button>
        </div>

        <div className="docs-filter">
          <Search />
          <input
            ref={inputRef}
            type="search"
            className="docs-filter-input"
            placeholder="Filter pages"
            aria-label="Filter documentation pages"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setCursor(0);
            }}
            onKeyDown={onFieldKey}
          />
          {query ? null : <kbd className="docs-kbd">/</kbd>}
        </div>

        {query ? (
          <div className="docs-results">
            {results.length ? (
              <ul>
                {results.map((r, i) => (
                  <li key={r.href}>
                    <button
                      type="button"
                      className={`docs-result${i === active ? " is-active" : ""}`}
                      onMouseEnter={() => setCursor(i)}
                      onClick={() => go(r.href)}
                    >
                      <span className="docs-result-title">{r.title}</span>
                      <span className="meta">{r.page}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="small muted docs-result-empty">Nothing matches “{query}”.</p>
            )}
          </div>
        ) : (
          <div className="docs-tree">
            {nav.map((section) => (
              <section key={section.dir}>
                <h2 className="label docs-group">{section.title}</h2>
                <ul>
                  {section.items.map((item) => {
                    const isCurrent = item.href === current;
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          className={`docs-link${isCurrent ? " is-current" : ""}`}
                          aria-current={isCurrent ? "page" : undefined}
                          onClick={() => setOpen(false)}
                        >
                          {item.title}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}
      </nav>

      <div className="docs-main">
        <div className="docs-topline">
          <button
            type="button"
            className="btn btn-sm docs-menu-btn"
            onClick={focusFilter}
            aria-expanded={open}
            aria-label="Open the documentation menu"
          >
            <Menu />
            Docs menu
          </button>
          <nav className="docs-crumbs" aria-label="Breadcrumb">
            <ol>
              {crumbs.map((c) => (
                <li key={c.label}>
                  {c.href ? (
                    <Link href={c.href}>{c.label}</Link>
                  ) : (
                    <span aria-current={c === crumbs[crumbs.length - 1] ? "page" : undefined}>
                      {c.label}
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </nav>
        </div>
        {children}
      </div>

      {rail}
    </div>
  );
}
