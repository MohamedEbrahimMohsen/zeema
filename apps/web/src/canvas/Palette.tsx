"use client";

import { isGeneric } from "@zeema/core/document";
import { useEffect, useMemo, useRef } from "react";

/** [id, name, kind, category, provider, haystack, aliases] — see `searchRows` in @zeema/catalogue. */
type Row = [string, string, string, string, string, string, string];
const LIMIT = 60;

function parseQuery(q: string) {
  const filters: Record<string, string> = {};
  const words: string[] = [];
  for (const token of q.toLowerCase().split(/\s+/).filter(Boolean)) {
    const m = /^(provider|kind|category):(.+)$/.exec(token);
    if (m) filters[m[1]] = m[2];
    else words.push(token);
  }
  return { filters, words };
}

function score(row: Row, words: string[]) {
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

export function Palette({
  rows,
  icons,
  query,
  onQuery,
  focusSeq,
  onCreate,
}: {
  rows: Row[];
  icons: Record<string, string>;
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
  const { hits, total } = useMemo(() => {
    const { filters, words } = parseQuery(q);
    const out: Array<[number, Row]> = [];
    for (const row of rows) {
      if (filters.provider && row[4] !== filters.provider) continue;
      if (filters.kind && row[2] !== filters.kind) continue;
      if (filters.category && row[3] !== filters.category) continue;
      const s = score(row, words);
      if (s) out.push([s, row]);
    }
    // Categories stay alphabetical, except `custom`, which is the last resort and sits last.
    // Inside a category the vendor-neutral component comes before the products of its kind.
    const rank = (row: Row) => (row[3] === "custom" ? "zzzz" : row[3]);
    out.sort(
      (a, b) =>
        rank(a[1]).localeCompare(rank(b[1])) ||
        b[0] - a[0] ||
        Number(isGeneric(b[1][0], b[1][2])) - Number(isGeneric(a[1][0], a[1][2])) ||
        a[1][1].localeCompare(b[1][1]),
    );
    return { hits: out.slice(0, LIMIT).map((h) => h[1]), total: out.length };
  }, [q, rows]);

  let category: string | null = null;
  return (
    <>
      <input
        className="input pal-search"
        ref={box}
        placeholder="Search components… kind:queue provider:aws"
        value={q}
        onChange={(e) => onQuery(e.target.value)}
      />
      <div className="pal-results">
        {hits.length === 0 ? (
          <div className="muted p-3">
            Nothing matches. Try a product name, or <code>kind:queue</code>.
          </div>
        ) : null}
        {hits.map((row) => {
          const [id, name, kind, cat] = row;
          const header = cat !== category ? cat : null;
          category = cat;
          const generic = isGeneric(id, kind);
          return (
            <div key={id}>
              {header ? <div className="pal-group">{header}</div> : null}
              {header && cat === "custom" ? (
                <div className="pal-hint">
                  Last resort. A custom node keeps the picture complete, but no rule can read it.
                </div>
              ) : null}
              <button
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
            </div>
          );
        })}
        {total > hits.length ? (
          <div className="meta p-2">{total - hits.length} more, keep typing</div>
        ) : null}
      </div>
    </>
  );
}
