"use client";

import { useMemo, useState } from "react";

type Row = [string, string, string, string, string, string];
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
  const [id, name, , , , hay] = row;
  if (!words.length) return 1;
  let s = 0;
  for (const w of words) {
    if (!hay.includes(w)) return 0;
    if (id.startsWith(w) || name.toLowerCase().startsWith(w)) s += 3;
    else if (id.includes(w)) s += 2;
    else s += 1;
  }
  return s;
}

export function Palette({
  rows,
  icons,
  onCreate,
}: {
  rows: Row[];
  icons: Record<string, string>;
  onCreate: (id: string) => void;
}) {
  const [q, setQ] = useState("");
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
    out.sort(
      (a, b) => a[1][3].localeCompare(b[1][3]) || b[0] - a[0] || a[1][1].localeCompare(b[1][1]),
    );
    return { hits: out.slice(0, LIMIT).map((h) => h[1]), total: out.length };
  }, [q, rows]);

  let category: string | null = null;
  return (
    <>
      <input
        className="input pal-search"
        placeholder="Search components… kind:queue provider:aws"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div className="pal-results">
        {hits.length === 0 ? (
          <div className="muted p-3">Nothing matches. Try a product name, or kind:queue.</div>
        ) : null}
        {hits.map((row) => {
          const [id, name, kind, cat] = row;
          const header = cat !== category ? cat : null;
          category = cat;
          return (
            <div key={id}>
              {header ? <div className="pal-group">{header}</div> : null}
              <button
                type="button"
                className="pal-row"
                draggable
                title={`${id} · ${kind}`}
                onDragStart={(e) => e.dataTransfer.setData("text/arkore-component", id)}
                onDoubleClick={() => onCreate(id)}
              >
                {/* biome-ignore lint/security/noDangerouslySetInnerHtml: catalogue icon markup, sanitised at build */}
                <svg viewBox="0 0 24 24" dangerouslySetInnerHTML={{ __html: icons[id] ?? "" }} />
                <span className="name">{name}</span>
                <span className="kind">{kind}</span>
              </button>
            </div>
          );
        })}
        {total > hits.length ? (
          <div className="muted p-2 text-xs">{total - hits.length} more, keep typing</div>
        ) : null}
      </div>
    </>
  );
}
