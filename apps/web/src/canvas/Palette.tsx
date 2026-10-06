"use client";

import { isGeneric } from "@zeema/core/document";
import { scoreRow } from "@zeema/core/search";
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

/** See `scoreRow` in @zeema/core/search: synonyms (`db` → database) and name-before-description. */
export function score(row: Row, words: string[]): number {
  return scoreRow(row, words);
}

/**
 * The provider brand marks, each defined once as `<symbol id="prov-<provider>">` for the picker
 * and quick actions to `<use>`. Rendered once per canvas; `default` has no mark.
 */
export function ProviderSprite({ icons }: { icons: Record<string, string> }) {
  const ids = Object.keys(icons)
    .filter((k) => k.startsWith("provider:"))
    .map((k) => k.slice("provider:".length));
  return (
    <svg className="prov-sprite" aria-hidden="true" focusable="false" width="0" height="0">
      {ids.map((id) => (
        <symbol
          key={id}
          id={`prov-${id}`}
          viewBox="0 0 24 24"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: provider mark from icons/providers, passed by the gate
          dangerouslySetInnerHTML={{ __html: icons[`provider:${id}`] }}
        />
      ))}
    </svg>
  );
}

/** A provider's mark from the sprite, or nothing for `default` and any provider without one. */
export function ProviderMark({
  provider,
  icons,
}: {
  provider: string;
  icons: Record<string, string>;
}) {
  if (!icons[`provider:${provider}`]) return null;
  return (
    <svg className="prov-mark" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <use href={`#prov-${provider}`} />
    </svg>
  );
}

/** A row's tooltip: `Provider · Kind`, or the kind alone for `default`, from the locale. */
export function rowTip(
  row: Row,
  providerNames?: Record<string, string>,
  kindNames?: Record<string, string>,
) {
  const [, , kind, , provider] = row;
  const k = kindNames?.[kind] ?? kind;
  return provider && provider !== "default"
    ? `${providerLabel(provider, providerNames)} · ${k}`
    : k;
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
  kindNames,
  query,
  onQuery,
  focusSeq,
  onCreate,
  recent = [],
  suggested = [],
}: {
  rows: Row[];
  icons: Record<string, string>;
  /** Provider display names from the locale, keyed by provider id (a folder under components/). */
  providerNames?: Record<string, string>;
  /** Category display names from the locale, keyed by category id. */
  categoryNames?: Record<string, string>;
  /** Kind display names from the locale, keyed by kind id: the row tooltip names the kind. */
  kindNames?: Record<string, string>;
  /** The search box is owned above, so the canvas can point the palette at a category. */
  query: string;
  onQuery: (q: string) => void;
  /** Bumped when someone asked for the palette rather than typed in it; the box takes focus. */
  focusSeq: number;
  /** A row was clicked: place that component in the middle of the view. */
  onCreate: (id: string) => void;
  /** Component ids this browser added most recently, newest first: the "Most used" section. */
  recent?: string[];
  /** Component ids to offer first, before any typing: the "Suggested" section. */
  suggested?: string[];
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
    // With words typed, the category holding the best hit leads ("db" opens on Data, not on a
    // compute row whose description mentions JDBC); with none, categories keep their own order.
    const best: Record<string, number> = {};
    if (words.length) for (const [s, row] of out) best[row[3]] = Math.max(best[row[3]] ?? 0, s);
    // Inside a category the vendor-neutral component comes before the products of its kind.
    out.sort(
      (a, b) =>
        (best[b[1][3]] ?? 0) - (best[a[1][3]] ?? 0) ||
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

  // "Most used" is what this browser placed last. It answers "the usual thing" before any typing,
  // so it shows only on an empty query and steps aside the moment the person searches.
  const recentRows = useMemo(() => {
    if (q.trim() || !recent.length) return [];
    const byId = new Map(rows.map((r) => [r[0], r]));
    return recent.map((id) => byId.get(id)).filter((r): r is Row => Boolean(r));
  }, [q, recent, rows]);

  // "Suggested" is what the caller thinks fits here (the design's own most-used components, when
  // a wire was let go on empty canvas). Like "Most used", it answers an empty query only.
  const suggestedRows = useMemo(() => {
    if (q.trim() || !suggested.length) return [];
    const byId = new Map(rows.map((r) => [r[0], r]));
    return suggested.map((id) => byId.get(id)).filter((r): r is Row => Boolean(r));
  }, [q, suggested, rows]);

  // A row is the component button and, beside it, the provider's mark as its own button: one
  // press filters the picker to that provider, a second clears it. Siblings, not nested, since a
  // button cannot hold a button. The kind, no longer printed, is in the tooltip and the label.
  const rowButton = (row: Row, keyPrefix = "") => {
    const [id, name, , , provider] = row;
    const tip = rowTip(row, providerNames, kindNames);
    const marked = Boolean(icons[`provider:${provider}`]);
    const on = filters.provider === provider;
    const pName = providerLabel(provider, providerNames);
    return (
      <div key={`${keyPrefix}${id}`} className="pal-item">
        <button
          type="button"
          className="pal-row"
          draggable
          title={tip}
          aria-label={`${name} · ${tip}`}
          onDragStart={(e) => e.dataTransfer.setData("text/zeema-component", id)}
          onClick={() => onCreate(id)}
        >
          {/* biome-ignore lint/security/noDangerouslySetInnerHtml: catalogue icon markup, sanitised at build */}
          <svg viewBox="0 0 24 24" dangerouslySetInnerHTML={{ __html: icons[id] ?? "" }} />
          <span className="name">{name}</span>
          {marked ? <span className="pal-mark-slot" /> : null}
        </button>
        {marked ? (
          <button
            type="button"
            className="pal-mark"
            title={pName}
            aria-label={pName}
            aria-pressed={on}
            draggable={false}
            onClick={(e) => {
              e.stopPropagation();
              pick("provider", on ? "" : provider);
            }}
          >
            <ProviderMark provider={provider} icons={icons} />
          </button>
        ) : null}
      </div>
    );
  };

  // A chip row is a single-select: "All" clears the token, any other chip writes it. A typed
  // value the catalogue does not offer still gets a chip, so the row never hides the filter.
  const chips = (
    key: "provider" | "category",
    label: string,
    values: string[],
    name: (v: string) => string,
  ) => {
    const current = filters[key] ?? "";
    const all = current && !values.includes(current) ? [...values, current] : values;
    return (
      <fieldset className="pal-chips">
        <legend className="pal-chips-label">{label}</legend>
        {["", ...all].map((v) => (
          <button
            key={v || "all"}
            type="button"
            aria-pressed={current === v}
            className={`chip${current === v ? " is-on" : ""}`}
            onClick={() => pick(key, v)}
          >
            {v ? name(v) : "All"}
          </button>
        ))}
      </fieldset>
    );
  };

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
        {chips("provider", "Provider", providers, (p) => providerLabel(p, providerNames))}
        {chips("category", "Category", categories, (c) => categoryLabel(c, categoryNames))}
      </div>
      <div className="pal-results">
        {sorted.length === 0 ? (
          <div className="muted p-3">
            Nothing matches. Try a product name, or <code>kind:queue</code>.
          </div>
        ) : null}
        {suggestedRows.length ? (
          <div className="pal-recent">
            <div className="pal-group pal-group-static">
              <span>Suggested</span>
              <span className="count">{suggestedRows.length}</span>
            </div>
            {suggestedRows.map((row) => rowButton(row, "suggested:"))}
          </div>
        ) : null}
        {recentRows.length ? (
          <div className="pal-recent">
            <div className="pal-group pal-group-static">
              <span>Most used</span>
              <span className="count">{recentRows.length}</span>
            </div>
            {recentRows.map((row) => rowButton(row, "recent:"))}
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
          return rowButton(item.row);
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
