"use client";

// A `.doc-section` that folds, with the same disclosure mechanics as the YAML panel: the head is
// the <summary>, the count sits in it, and the toolbar is a sibling of the summary so a click on
// an action does not also fold the section away.
//
// Whether it is open is remembered per browser, keyed by the section's name, so a reader who
// keeps History open finds it open next time. Storage is a convenience: a browser that refuses
// it (private mode, blocked site data) simply gets the default every time. The first paint
// always uses the default, so the server's markup and the client's agree; the stored choice is
// applied once the component is mounted.
import { type ReactNode, useEffect, useRef, useState } from "react";

const keyFor = (name: string) => `zeema-section-${name}`;

type Props = {
  /** Stable name for the stored state; also the fallback aria label. */
  name: string;
  title: string;
  /** Shown beside the title, e.g. "Findings · 3". */
  count?: ReactNode;
  /** Open the first time this browser sees the section. */
  defaultOpen?: boolean;
  /** Extra head content, pushed to the right of the title (a tally, a summary line). */
  aside?: ReactNode;
  /** The icon toolbar, floated over the right of the head. */
  actions?: ReactNode;
  /**
   * Bumped by the owner of a toolbar action that needs the body on screen — editing the README
   * from a folded About. Any change opens the section and remembers it, exactly as a click does.
   */
  openSeq?: number;
  children: ReactNode;
};

export function CollapsibleSection({
  name,
  title,
  count,
  defaultOpen = false,
  aside,
  actions,
  openSeq,
  children,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(keyFor(name));
      if (stored === "open" || stored === "closed") setOpen(stored === "open");
    } catch {}
    // A link to the section (the canvas menu's Releases) opens it, without remembering that.
    if (window.location.hash === `#section-${name}`) setOpen(true);
  }, [name]);

  const remember = (next: boolean) => {
    setOpen(next);
    try {
      window.localStorage.setItem(keyFor(name), next ? "open" : "closed");
    } catch {}
  };

  // Deliberately not `remember`: being shown the body because an action needed it is not the
  // same as choosing to keep the section open, and the stored choice stands.
  // The value it was mounted with means nothing; only a change to it asks for the body.
  const seen = useRef(openSeq);
  useEffect(() => {
    if (openSeq === undefined || openSeq === seen.current) return;
    seen.current = openSeq;
    setOpen(true);
  }, [openSeq]);

  return (
    <section className="panel doc-section" id={`section-${name}`}>
      <details
        className="doc-details"
        open={open}
        onToggle={(e) => {
          const next = (e.currentTarget as HTMLDetailsElement).open;
          if (next !== open) remember(next);
        }}
      >
        <summary className={`doc-head${actions ? "" : " doc-head-full"} flex items-baseline gap-2`}>
          <span>{title}</span>
          {count !== undefined && count !== null ? (
            <span className="count mono">· {count}</span>
          ) : null}
          {aside ? <span className="ml-auto">{aside}</span> : null}
        </summary>
        <div className="doc-body">{children}</div>
      </details>
      {actions ? <div className="doc-actions">{actions}</div> : null}
    </section>
  );
}
