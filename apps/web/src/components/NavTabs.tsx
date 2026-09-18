"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS: Array<[string, string]> = [
  ["/browse", "Browse"],
  ["/catalogue", "Catalogue"],
  ["/docs", "Docs"],
];

export function NavTabs() {
  const path = usePathname() ?? "/";
  return (
    <nav className="tabs" aria-label="Primary">
      {TABS.map(([href, label]) => (
        <Link
          key={href}
          href={href}
          className={`tab${path === href || path.startsWith(`${href}/`) ? " active" : ""}`}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
