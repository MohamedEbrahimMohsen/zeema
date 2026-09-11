"use client";

// Three states: system follows the OS, light and dark pin. The choice lives in localStorage
// under the key the boot script in layout.tsx reads, so a reload paints the right theme first.
import { useEffect, useState } from "react";

type Pref = "system" | "light" | "dark";
const KEY = "arkore-theme";

function apply(p: Pref) {
  const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.setAttribute(
    "data-theme",
    p === "system" ? (dark ? "dark" : "light") : p,
  );
}

export function ThemeToggle() {
  const [pref, setPref] = useState<Pref>("system");
  useEffect(() => {
    try {
      const stored = localStorage.getItem(KEY) as Pref | null;
      if (stored === "light" || stored === "dark") setPref(stored);
    } catch {}
  }, []);
  const choose = (p: Pref) => {
    setPref(p);
    try {
      localStorage.setItem(KEY, p);
    } catch {}
    apply(p);
  };
  return (
    <fieldset className="seg" aria-label="Theme" style={{ border: 0, padding: 0, margin: 0 }}>
      {(["system", "light", "dark"] as Pref[]).map((p) => (
        <button
          key={p}
          type="button"
          className={pref === p ? "active" : ""}
          aria-pressed={pref === p}
          onClick={() => choose(p)}
        >
          {p}
        </button>
      ))}
    </fieldset>
  );
}
