"use client";

// "Move to group…": a small searchable list of the design's groups, at the point the menu was
// opened. Typing filters by label, id and kind; the arrows move, Enter picks, Escape closes.
// The last row takes the selection out of every group.
import { useEffect, useId, useMemo, useRef, useState } from "react";

export type GroupRow = {
  id: string | null;
  label: string;
  sub: string;
  depth: number;
  path: string;
};

/** The groups outer-first, each followed by its children, with the path that names it. */
export function groupRows(groups: any[]): GroupRow[] {
  const out: GroupRow[] = [];
  const byParent = new Map<string | null, any[]>();
  const ids = new Set(groups.map((g) => g.id));
  for (const g of groups) {
    const p = g.parent && ids.has(g.parent) ? g.parent : null;
    byParent.set(p, [...(byParent.get(p) ?? []), g]);
  }
  const seen = new Set<string>();
  const walk = (parent: string | null, depth: number, trail: string[]) => {
    for (const g of byParent.get(parent) ?? []) {
      if (seen.has(g.id)) continue;
      seen.add(g.id);
      const label = String(g.label || g.id);
      const path = [...trail, label];
      out.push({ id: g.id, label, sub: `${g.kind} · ${g.id}`, depth, path: path.join(" › ") });
      walk(g.id, depth + 1, path);
    }
  };
  walk(null, 0, []);
  return out;
}

export function GroupPicker({
  x,
  y,
  groups,
  current,
  onPick,
  onClose,
}: {
  x: number;
  y: number;
  groups: any[];
  /** The group every selected component is in now (null: top level; undefined: mixed). */
  current: string | null | undefined;
  onPick: (groupId: string | null) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLInputElement>(null);
  const listId = useId();
  const all = useMemo(() => groupRows(groups), [groups]);
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const hit = q ? all.filter((r) => `${r.path} ${r.sub}`.toLowerCase().includes(q)) : all;
    const none: GroupRow = { id: null, label: "No group (top level)", sub: "", depth: 0, path: "" };
    return [...hit, none];
  }, [all, query]);
  const at = Math.min(active, rows.length - 1);
  // A new query starts at the top.
  useEffect(() => setActive(0), [query]);
  useEffect(() => box.current?.focus(), []);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.left = `${Math.max(8, Math.min(x, window.innerWidth - r.width - 8))}px`;
    el.style.top = `${Math.max(8, Math.min(y, window.innerHeight - r.height - 8))}px`;
  }, [x, y]);
  useEffect(() => {
    const away = (ev: PointerEvent) => {
      if (ref.current && !ref.current.contains(ev.target as Node)) onClose();
    };
    window.addEventListener("pointerdown", away, true);
    window.addEventListener("blur", onClose);
    return () => {
      window.removeEventListener("pointerdown", away, true);
      window.removeEventListener("blur", onClose);
    };
  }, [onClose]);
  useEffect(() => {
    ref.current
      ?.querySelector<HTMLElement>(`[data-index="${at}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [at]);

  const pick = (row: GroupRow | undefined) => {
    if (!row) return;
    onClose();
    onPick(row.id);
  };
  const onKeyDown = (ev: React.KeyboardEvent) => {
    // Every key here belongs to the picker; none should reach the canvas's own bindings.
    ev.stopPropagation();
    if (ev.key === "Escape" || ev.key === "Tab") {
      ev.preventDefault();
      onClose();
    } else if (ev.key === "ArrowDown") {
      ev.preventDefault();
      setActive((at + 1) % rows.length);
    } else if (ev.key === "ArrowUp") {
      ev.preventDefault();
      setActive((at - 1 + rows.length) % rows.length);
    } else if (ev.key === "Enter") {
      ev.preventDefault();
      pick(rows[at]);
    }
  };
  const searching = query.trim() !== "";
  const optionId = (i: number) => `${listId}-o${i}`;
  return (
    <div
      ref={ref}
      className="zeema-menu group-picker"
      role="dialog"
      aria-label="Move to group"
      style={{ left: x, top: y }}
      onKeyDown={onKeyDown}
    >
      <input
        ref={box}
        className="input gp-search"
        placeholder="Search groups…"
        aria-label="Search groups"
        role="combobox"
        aria-expanded="true"
        aria-controls={listId}
        aria-activedescendant={optionId(at)}
        value={query}
        onChange={(ev) => setQuery(ev.target.value)}
      />
      <div className="gp-list" id={listId} role="listbox" aria-label="Groups">
        {rows.length === 1 && searching ? (
          <div className="muted gp-empty">No group matches.</div>
        ) : null}
        {rows.map((r, i) => (
          <div
            key={r.id ?? "(none)"}
            id={optionId(i)}
            data-index={i}
            role="option"
            tabIndex={-1}
            aria-selected={i === at}
            className={`gp-row${i === at ? " is-active" : ""}${r.id === null ? " gp-none" : ""}`}
            style={{ paddingLeft: 10 + (searching ? 0 : r.depth * 14) }}
            onPointerMove={() => i !== at && setActive(i)}
            onPointerDown={(ev) => ev.preventDefault()}
            onClick={() => pick(r)}
            onKeyDown={() => {}}
          >
            <span className="gp-label">{searching && r.id ? r.path : r.label}</span>
            {r.sub ? <span className="gp-sub">{r.sub}</span> : null}
            {r.id === current ? <span className="gp-current">current</span> : null}
          </div>
        ))}
      </div>
    </div>
  );
}
