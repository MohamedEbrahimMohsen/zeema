"use client";

// "On this page": the headings of the article, with the one you are reading marked.
//
// The mark follows the scroll rather than the hash, because a hash only changes when someone
// clicks. An IntersectionObserver watches every heading through a band across the upper part of
// the viewport and the last heading to cross it wins; that is stable while scrolling either way
// and costs nothing between scrolls.
//
// It is the same element at every width. Above 1024px the shell puts it in the right-hand column
// and the stylesheet opens it and hides the summary, so it reads as a rail; below that the grid
// is one column and it is an ordinary closed disclosure above the article, costing one row until
// somebody wants it.
import { useEffect, useRef, useState } from "react";
import type { DocHeading } from "@/lib/docs";

export function DocsToc({ headings }: { headings: DocHeading[] }) {
  const [active, setActive] = useState<string>(headings[0]?.id ?? "");
  const seen = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!headings.length) return;
    const nodes = headings
      .map((h) => document.getElementById(h.id))
      .filter((n): n is HTMLElement => Boolean(n));
    if (!nodes.length) return;
    seen.current = new Set();
    const order = headings.map((h) => h.id);
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) seen.current.add(e.target.id);
          else seen.current.delete(e.target.id);
        }
        const visible = order.filter((id) => seen.current.has(id));
        if (visible.length) {
          setActive(visible[0]);
          return;
        }
        // Nothing is in the band, which happens inside a section longer than the viewport — a
        // wide table, a long sample. The heading you are under is the last one that has gone
        // past the top.
        const passed = nodes.filter((n) => n.getBoundingClientRect().top < 120).at(-1);
        if (passed) setActive(passed.id);
      },
      // A band from just under the site header to the middle of the viewport: a heading is
      // "current" from the moment it reaches the top, and stays so until the next one does.
      { rootMargin: "-80px 0px -55% 0px", threshold: 0 },
    );
    for (const n of nodes) observer.observe(n);
    return () => observer.disconnect();
  }, [headings]);

  if (headings.length < 2) return null;

  return (
    <details className="doc-toc">
      <summary className="doc-toc-summary">On this page</summary>
      <nav className="doc-toc-body" aria-label="On this page">
        <span className="label doc-toc-label">On this page</span>
        <ul>
          {headings.map((h) => (
            <li key={h.id} className={h.level === 3 ? "is-sub" : ""}>
              <a
                href={`#${h.id}`}
                className={h.id === active ? "is-active" : ""}
                aria-current={h.id === active ? "true" : undefined}
              >
                {h.text}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </details>
  );
}
