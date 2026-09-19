"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS: Array<[string, string]> = [
  ["/", "Browse"],
  ["/catalogue", "Catalogue"],
  ["/docs", "Docs"],
];

// "/" is a prefix of every path, so the front page matches exactly and the rest by segment.
const isActive = (path: string, href: string) =>
  href === "/" ? path === "/" : path === href || path.startsWith(`${href}/`);

export function NavTabs() {
  const path = usePathname() ?? "/";
  return (
    <nav className="tabs" aria-label="Primary">
      {TABS.map(([href, label]) => (
        <Link key={href} href={href} className={`tab${isActive(path, href) ? " active" : ""}`}>
          {label}
        </Link>
      ))}
    </nav>
  );
}
