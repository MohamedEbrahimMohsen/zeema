"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export const TABS: Array<[string, string]> = [
  ["/", "Browse"],
  ["/catalogue", "Catalogue"],
  ["/docs", "Docs"],
];

// "/" is a prefix of every path, so the front page matches exactly and the rest by segment.
export const isActive = (path: string, href: string) =>
  href === "/" ? path === "/" : path === href || path.startsWith(`${href}/`);

// A segmented control inside the left nav pill: the tab for the current section is filled.
export function NavTabs() {
  const path = usePathname() ?? "/";
  return (
    <nav className="tabs tabs-segmented" aria-label="Primary">
      {TABS.map(([href, label]) => {
        const on = isActive(path, href);
        return (
          <Link
            key={href}
            href={href}
            className={`tab${on ? " active" : ""}`}
            aria-current={on ? "page" : undefined}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
