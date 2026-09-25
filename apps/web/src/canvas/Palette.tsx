"use client";

import { isGeneric } from "@zeema/core/document";
import { useEffect, useMemo, useRef, useState } from "react";
import { categoryLabel, providerLabel, setToken } from "./palette-query";

/** [id, name, kind, category, provider, haystack, aliases] — see `searchRows` in @zeema/catalogue. */
export type Row = [string, string, string, string, string, string, string];
// One page of rows. 2,000-odd components each carry an inline SVG, so the list grows a page at
// a time instead of drawing the whole catalogue on every keystroke.
const LIMIT = 60;

export function parseQuery(q: string) {
  const filters: Record<string, string> = {};
  const words: string[] = [];
  for (const token of q.toLowerCase().split(/\s+/).filter(Boolean)) {
    const m = /^(provider|kind|category):(.+)$/.exec(token);
    if (m) filters[m[1]] = m[2];
    else words.push(token);
  }
  return { filters, words };
}

export function score(row: Row, words: string[]) {
  const [id, name, , , , hay, aliases] = row;
  if (!words.length) return 1;
  // An alias is a name the vendor uses, so it weighs what the name weighs: typing `dcr` should
  // put the data collection rule first, not behind every description that mentions it.
  const alias = (aliases ?? "").split(" ").filter(Boolean);
  let s = 0;
  for (const w of words) {
    if (!hay.includes(w)) return 0;
    if (id.startsWith(w) || name.toLowerCase().startsWith(w) || alias.some((a) => a.startsWith(w)))
      s += 3;
    else if (id.includes(w)) s += 2;
    else s += 1;
  }
  return s;
}

const COLLAPSED_KEY = "zeema.palette.collapsed";
const readCollapsed = (): string[] => {
  try {
    const v = JSON.parse(window.localStorage.getItem(COLLAPSED_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
};

// Categories stay alphabetical, except `custom`, which is the last resort and sits last.
const catRank = (cat: string) => (cat === "custom" ? "zzzz" : cat);

type Item =
  | { type: "header"; cat: string; count: number; open: boolean }
  | { type: "row"; row: Row };

export function Palette({
  rows,
  icons,
  providerNames,
  categoryNames,
  query,
  onQuery,
  focusSeq,
  onCreate,
}: {
  rows: Row[];
  icons: Record<string, string>;
  /** Provider display names from the locale, keyed by provider id (a folder under components/). */
  providerNames?: Record<string, string>;
  /** Category display names from the locale, keyed by category id. */
  categoryNames?: Record<string, string>;
  /** The search box is owned above, so the canvas can point the palette at a category. */
  query: string;
  onQuery: (q: string) => void;
  /** Bumped when someone asked for the palette rather than typed in it; the box takes focus. */
  focusSeq: number;
  onCreate: (id: string) => void;
}) {
  const q = query;
  const box = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (focusSeq) box.current?.focus();
  }, [focusSeq]);

  // How many rows to draw. A new query (a filter is part of the query) starts again at one
  // page; "Show more" adds a page to this query only.
  const [page, setPage] = useState({ q, n: LIMIT });
  const limit = page.q === q ? page.n : LIMIT;

  // Folded categories are a habit of this browser. Read after mount, so the server render and
  // the first client render agree.
  const [collapsed, setCollapsed] = useState<string[]>([]);
  useEffect(() => setCollapsed(readCollapsed()), []);
  const toggleCategory = (cat: string) => {
    setCollapsed((prev) => {
      const next = prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat];
      try {
        window.localStorage.setItem(COLLAPSED_KEY, JSON.stringify(next));
      } catch {
        /* a browser that will not remember still folds for this visit */
      }
      return next;
    });
  };

  const { providers, categories } = useMemo(() => {
    const p = new Set<string>();
    const c = new Set<string>();
    for (const row of rows) {
      if (row[4]) p.add(row[4]);
      if (row[3]) c.add(row[3]);
    }
    return {
      providers: [...p].sort((a, b) =>
        providerLabel(a, providerNames).localeCompare(providerLabel(b, providerNames)),
      ),
      categories: [...c].sort((a, b) => catRank(a).localeCompare(catRank(b))),
    };
  }, [rows, providerNames]);

  const { filters } = parseQuery(q);

  const sorted = useMemo(() => {
    const { filters, words } = parseQuery(q);
    const out: Array<[number, Row]> = [];
    for (const row of rows) {
      if (filters.provider && row[4] !== filters.provider) continue;
      if (filters.kind && row[2] !== filters.kind) continue;
      if (filters.category && row[3] !== filters.category) continue;
      const s = score(row, words);
      if (s) out.push([s, row]);
    }
    // Inside a category the vendor-neutral component comes before the products of its kind.
    out.sort(
      (a, b) =>
        catRank(a[1][3]).localeCompare(catRank(b[1][3])) ||
        b[0] - a[0] ||
        Number(isGeneric(b[1][0], b[1][2])) - Number(isGeneric(a[1][0], a[1][2])) ||
        a[1][1].localeCompare(b[1][1]),
    );
    return out.map((h) => h[1]);
  }, [q, rows]);

  // Headers and rows in order, with at most `limit` rows. A folded category keeps its header
  // (and its count) but spends none of the page. Pointing the palette at one category unfolds
  // it: that is what the person asked to see.
  const { items, remaining } = useMemo(() => {
    const perCat = new Map<string, number>();
    for (const row of sorted) perCat.set(row[3], (perCat.get(row[3]) ?? 0) + 1);
    const folded = new Set(filters.category ? [] : collapsed);
    const items: Item[] = [];
    let shown = 0;
    let visible = 0;
    let current: string | null = null;
    for (const row of sorted) {
      const cat = row[3];
      const open = !folded.has(cat);
      if (open) visible++;
      if (shown >= limit) continue;
      if (cat !== current) {
        current = cat;
        items.push({ type: "header", cat, count: perCat.get(cat) ?? 0, open });
      }
      if (open) {
        items.push({ type: "row", row });
        shown++;
      }
    }
    return { items, remaining: visible - shown };
  }, [sorted, collapsed, filters.category, limit]);

  const pick = (key: "provider" | "category", value: string) =>
    onQuery(setToken(q, key, value || null));

  return (
    <>
      <input
        className="input pal-search"
        ref={box}
        placeholder="Search components…"
        aria-label="Search components"
        value={q}
        onChange={(e) => onQuery(e.target.value)}
      />
      <div className="pal-filters">
        <select
          className="input pal-select"
          aria-label="Provider"
          value={filters.provider ?? ""}
          onChange={(e) => pick("provider", e.target.value)}
        >
          <option value="">All providers</option>
          {filters.provider && !providers.includes(filters.provider) ? (
            <option value={filters.provider}>{filters.provider}</option>
          ) : null}
          {providers.map((p) => (
            <option key={p} value={p}>
              {providerLabel(p, providerNames)}
            </option>
          ))}
        </select>
        <select
          className="input pal-select"
          aria-label="Category"
          value={filters.category ?? ""}
          onChange={(e) => pick("category", e.target.value)}
        >
          <option value="">All categories</option>
          {filters.category && !categories.includes(filters.category) ? (
            <option value={filters.category}>{filters.category}</option>
          ) : null}
          {categories.map((c) => (
            <option key={c} value={c}>
              {categoryLabel(c, categoryNames)}
            </option>
          ))}
        </select>
      </div>
      <div className="pal-results">
        {sorted.length === 0 ? (
          <div className="muted p-3">
            Nothing matches. Try a product name, or <code>kind:queue</code>.
          </div>
        ) : null}
        {items.map((item) => {
          if (item.type === "header") {
            const { cat, count, open } = item;
            return (
              <div key={`cat:${cat}`}>
                <button
                  type="button"
                  className="pal-group"
                  aria-expanded={open}
                  onClick={() => toggleCategory(cat)}
                >
                  <svg viewBox="0 0 12 12" className="chev" aria-hidden="true">
                    <path d="M4.5 2.5 8 6l-3.5 3.5" />
                  </svg>
                  <span>{cat}</span>
                  <span className="count">{count}</span>
                </button>
                {open && cat === "custom" ? (
                  <div className="pal-hint">
                    Last resort. A custom node keeps the picture complete, but no rule can read it.
                  </div>
                ) : null}
              </div>
            );
          }
          const [id, name, kind] = item.row;
          const generic = isGeneric(id, kind);
          return (
            <button
              key={id}
              type="button"
              className={`pal-row${generic ? " is-generic" : ""}`}
              draggable
              title={
                id === "custom"
                  ? "custom · a last resort: no rule can judge a custom node"
                  : generic
                    ? `${id} · ${kind} · vendor-neutral`
                    : `${id} · ${kind}`
              }
              onDragStart={(e) => e.dataTransfer.setData("text/zeema-component", id)}
              onDoubleClick={() => onCreate(id)}
            >
              {/* biome-ignore lint/security/noDangerouslySetInnerHtml: catalogue icon markup, sanitised at build */}
              <svg viewBox="0 0 24 24" dangerouslySetInnerHTML={{ __html: icons[id] ?? "" }} />
              <span className="name">{name}</span>
              <span className="kind">{generic ? "generic" : kind}</span>
            </button>
          );
        })}
        {remaining > 0 ? (
          <button
            type="button"
            className="pal-more meta"
            onClick={() => setPage({ q, n: limit + LIMIT })}
          >
            Show {Math.min(LIMIT, remaining)} more · {remaining} left
          </button>
        ) : null}
      </div>
    </>
  );
}
