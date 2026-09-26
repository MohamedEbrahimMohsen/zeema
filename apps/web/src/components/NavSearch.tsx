"use client";

// The search pill in the nav bar: an ordinary GET form onto the front page's listing, which
// already reads `q`, so it works without JavaScript. "/" focuses it from anywhere that is not a
// text field. On the front page, which carries its own search box, "/" goes to that box and the
// pill steps aside; the docs have their own "/" (the docs filter) and keep it.
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

const typing = (el: Element | null) =>
  el instanceof HTMLInputElement ||
  el instanceof HTMLTextAreaElement ||
  el instanceof HTMLSelectElement ||
  (el instanceof HTMLElement && el.isContentEditable);

export function NavSearch() {
  const path = usePathname() ?? "/";
  const input = useRef<HTMLInputElement>(null);
  const home = path === "/";
  const docs = path === "/docs" || path.startsWith("/docs/");

  useEffect(() => {
    if (docs) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented) return;
      if (typing(document.activeElement)) return;
      const target =
        document.querySelector<HTMLInputElement>("main .searchbox-input") ?? input.current;
      if (!target) return;
      e.preventDefault();
      target.focus();
      target.select();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [docs]);

  if (home) return null;
  return (
    <form action="/" method="get" className="nav-search">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" strokeLinecap="round" />
      </svg>
      <input
        ref={input}
        className="nav-search-input"
        name="q"
        type="search"
        autoComplete="off"
        placeholder="Search designs"
        aria-label="Search designs"
      />
      {docs ? null : (
        <kbd className="kbd" aria-hidden>
          /
        </kbd>
      )}
    </form>
  );
}
