"use client";

// Replaces Next's bottom-left activity indicator with a thin accent bar across the very top of
// the window, as modern apps do: fixed, 2px, over everything, so it never moves the page. It
// appears when an internal link is followed and disappears once the URL has changed (or after a
// safety timeout).
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export function RouteSpinner() {
  const [pending, setPending] = useState(false);
  const pathname = usePathname();
  const search = useSearchParams();
  const key = `${pathname}?${search?.toString() ?? ""}`;

  // biome-ignore lint/correctness/useExhaustiveDependencies: the URL key is the trigger
  useEffect(() => {
    setPending(false);
  }, [key]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      // Next's Link has already called preventDefault by the time this runs, so that flag
      // says nothing; only modifier keys and non-primary buttons opt out.
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.search === location.search) return;
      setPending(true);
    };
    const onSubmit = (e: SubmitEvent) => {
      const f = e.target as HTMLFormElement | null;
      if (!f) return;
      if ((f.getAttribute("action") ?? "").startsWith("/api/")) setPending(true);
    };
    document.addEventListener("click", onClick);
    document.addEventListener("submit", onSubmit);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("submit", onSubmit);
    };
  }, []);

  useEffect(() => {
    if (!pending) return;
    const t = setTimeout(() => setPending(false), 15000);
    return () => clearTimeout(t);
  }, [pending]);

  if (!pending) return null;
  return (
    <div className="route-bar" role="progressbar" aria-label="Loading">
      <span className="route-bar-fill" />
    </div>
  );
}
