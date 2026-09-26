"use client";

// A single light/dark switch. The stored value is always concrete: the boot script in
// layout.tsx seeds it from the OS on first visit, and from then on the last choice wins.
import { useEffect, useState } from "react";

type Theme = "light" | "dark";
const KEY = "zeema-theme";

// The cookie mirrors the choice for the server (src/lib/theme.ts), which picks the theme of the
// list thumbnails with it. The thumbnails already on the page are swapped here, so a flip (or a
// first visit, before the cookie existed) never leaves them in the other theme.
function remember(t: Theme) {
  try {
    localStorage.setItem(KEY, t);
  } catch {}
  // biome-ignore lint/suspicious/noDocumentCookie: the Cookie Store API is not in every browser yet
  document.cookie = `${KEY}=${t}; Path=/; Max-Age=31536000; SameSite=Lax`;
}
function syncThumbs(t: Theme) {
  for (const img of document.querySelectorAll<HTMLImageElement>("img[data-thumb]")) {
    const url = new URL(img.src, location.href);
    if (url.searchParams.get("theme") === t) continue;
    url.searchParams.set("theme", t);
    img.src = url.pathname + url.search;
  }
}

const SUN = (
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
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
);
const MOON = (
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
    <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" />
  </svg>
);

/**
 * `menu` renders the switch as a row of a dropdown menu (the phone nav menu) rather than as a
 * bare icon button in the bar.
 */
export function ThemeToggle({ variant = "icon" }: { variant?: "icon" | "menu" }) {
  const [theme, setTheme] = useState<Theme>("light");
  useEffect(() => {
    const t = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
    setTheme(t);
    syncThumbs(t);
  }, []);
  const flip = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    remember(next);
    syncThumbs(next);
  };
  const label = theme === "dark" ? "Switch to light theme" : "Switch to dark theme";
  if (variant === "menu")
    return (
      <button type="button" role="menuitem" className="menu-item menu-switch" onClick={flip}>
        <span>{label}</span>
        {theme === "dark" ? SUN : MOON}
      </button>
    );
  return (
    <button type="button" className="icon-btn" onClick={flip} aria-label={label} title={label}>
      {theme === "dark" ? SUN : MOON}
    </button>
  );
}
