"use client";

// Quick actions (⌘K): one box that reaches every command on the canvas, every component in the
// catalogue and every box already drawn. The arrows move, Enter runs, Escape closes and puts the
// keyboard back where it was. Ranking lives in quick-actions.ts; this only draws and dispatches.
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ProviderMark, type Row, rowTip } from "./Palette";
import {
  pushRecent,
  type QuickAction,
  type QuickEntry,
  type QuickTarget,
  quickSections,
} from "./quick-actions";

const RECENT_KEY = "zeema.quick.recent";
const readRecent = (): string[] => {
  try {
    const v = JSON.parse(window.localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
};
const writeRecent = (keys: string[]) => {
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(keys));
  } catch {
    /* a browser that will not remember still runs the action */
  }
};

export function QuickActions({
  actions,
  rows,
  icons,
  providerNames,
  kindNames,
  targets,
  onComponent,
  onGoto,
  onClose,
}: {
  actions: QuickAction[];
  rows: Row[];
  icons: Record<string, string>;
  /** Provider and kind display names from the locale, for a component row's tooltip. */
  providerNames?: Record<string, string>;
  kindNames?: Record<string, string>;
  targets: QuickTarget[];
  /** A component was chosen: place it in the middle of the view. */
  onComponent: (id: string) => void;
  /** A box of the design was chosen: select it and bring it into view. */
  onGoto: (target: QuickTarget) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [recent, setRecent] = useState<string[]>([]);
  useEffect(() => setRecent(readRecent()), []);
  const root = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  // Where the keyboard was when the palette opened, so closing it can put it back.
  const returnTo = useRef<HTMLElement | null>(null);
  const listId = useId();

  useEffect(() => {
    const was = document.activeElement as HTMLElement | null;
    returnTo.current = was && was !== document.body ? was : null;
    box.current?.focus();
  }, []);

  const sections = useMemo(
    () => quickSections({ query, actions, rows, targets, recent }),
    [query, actions, rows, targets, recent],
  );
  const flat = useMemo(() => sections.flatMap((s) => s.entries), [sections]);
  const at = Math.min(active, Math.max(0, flat.length - 1));

  // A new query starts at the top.
  useEffect(() => setActive(0), [query]);
  useEffect(() => {
    list.current
      ?.querySelector<HTMLElement>(`[data-index="${at}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [at]);

  const close = (restore: boolean) => {
    if (restore) returnTo.current?.focus?.();
    onClose();
  };

  // A press anywhere outside closes it; the press still does what it was going to do.
  useEffect(() => {
    const onDown = (ev: PointerEvent) => {
      if (!root.current?.contains(ev.target as Node)) onClose();
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [onClose]);

  const run = (entry: QuickEntry | undefined) => {
    if (!entry) return;
    const next = pushRecent(readRecent(), entry.key);
    writeRecent(next);
    const typed = query;
    // Focus goes back first, so an action that wants the keyboard (the picker) can take it.
    close(true);
    if (entry.kind === "action") entry.action.run(typed);
    else if (entry.kind === "component") onComponent(entry.row[0]);
    else onGoto(entry.target);
  };

  const onKeyDown = (ev: React.KeyboardEvent) => {
    // Every key here belongs to the palette; none should reach the canvas's own bindings.
    ev.stopPropagation();
    const toggle = (ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === "k";
    if (ev.key === "Escape" || toggle) {
      ev.preventDefault();
      close(true);
    } else if (ev.key === "ArrowDown") {
      ev.preventDefault();
      if (flat.length) setActive((at + 1) % flat.length);
    } else if (ev.key === "ArrowUp") {
      ev.preventDefault();
      if (flat.length) setActive((at - 1 + flat.length) % flat.length);
    } else if (ev.key === "Enter") {
      ev.preventDefault();
      run(flat[at]);
    }
  };

  let index = -1;
  const optionId = (i: number) => `${listId}-o${i}`;

  const body = (entry: QuickEntry) => {
    if (entry.kind === "component") {
      const [id, name, , , provider] = entry.row;
      return (
        <>
          <svg
            className="qa-icon"
            viewBox="0 0 24 24"
            // biome-ignore lint/security/noDangerouslySetInnerHtml: catalogue icon markup, sanitised at build
            dangerouslySetInnerHTML={{ __html: icons[id] ?? "" }}
          />
          <span className="qa-label">{name}</span>
          <ProviderMark provider={provider} icons={icons} />
        </>
      );
    }
    if (entry.kind === "goto") {
      const t = entry.target;
      return (
        <>
          <span className="qa-icon qa-glyph" aria-hidden="true">
            {t.type === "group" ? "▢" : "◇"}
          </span>
          <span className="qa-label">{t.label}</span>
          <span className="qa-sub">{t.type === "group" ? `group · ${t.id}` : t.id}</span>
        </>
      );
    }
    const a = entry.action;
    const label =
      a.always && query.trim() ? `${a.label.replace(/…$/, "")} “${query.trim()}”…` : a.label;
    return (
      <>
        <span className="qa-label">{label}</span>
        {a.hint ? (
          <span className="qa-keys">
            {a.hint.split(" ").map((k) => (
              <kbd key={k}>{k}</kbd>
            ))}
          </span>
        ) : null}
      </>
    );
  };

  return (
    <div className="float float-quick" ref={root}>
      <div
        className="card quick"
        role="dialog"
        aria-modal="false"
        aria-label="Quick actions"
        onKeyDown={onKeyDown}
      >
        <input
          ref={box}
          className="input qa-search"
          placeholder="Search actions, components, boxes…"
          aria-label="Search actions, components and boxes"
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-activedescendant={flat.length ? optionId(at) : undefined}
          value={query}
          onChange={(ev) => setQuery(ev.target.value)}
        />
        <div className="qa-results" id={listId} role="listbox" ref={list} aria-label="Results">
          {flat.length === 0 ? <div className="muted qa-empty">Nothing matches.</div> : null}
          {sections.map((section) => (
            <div className="qa-section" key={section.title}>
              <div className="qa-title">{section.title}</div>
              {section.entries.map((entry) => {
                index++;
                const i = index;
                const tip =
                  entry.kind === "component"
                    ? rowTip(entry.row, providerNames, kindNames)
                    : undefined;
                return (
                  <div
                    key={`${section.title}:${entry.key}`}
                    id={optionId(i)}
                    data-index={i}
                    role="option"
                    tabIndex={-1}
                    aria-selected={i === at}
                    className={`qa-row${i === at ? " is-active" : ""}`}
                    title={tip}
                    aria-label={
                      tip && entry.kind === "component" ? `${entry.row[1]} · ${tip}` : undefined
                    }
                    onPointerMove={() => i !== at && setActive(i)}
                    onPointerDown={(ev) => ev.preventDefault()}
                    onClick={() => run(entry)}
                    onKeyDown={() => {}}
                  >
                    {body(entry)}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
