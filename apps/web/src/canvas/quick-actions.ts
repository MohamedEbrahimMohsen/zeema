// The quick actions palette (⌘K) ranks three kinds of thing against one box: the canvas's own
// commands, the catalogue's components and the boxes already in the design. Ranking is pure, so
// it is tested here and the component only draws what this returns.
import { isGeneric } from "@zeema/core/document";
import { parseQuery, type Row, score } from "./Palette";

export type QuickGroup = "Recent" | "Add" | "Components" | "Go to" | "View" | "Design";

export type QuickAction = {
  /** Stable across visits: it is what "Recent" remembers. */
  id: string;
  group: "Add" | "View" | "Design";
  label: string;
  /** The shortcut, keys separated by spaces ("Ctrl Shift K"), shown on the right. */
  hint?: string;
  /** Other words it answers to, so "zoom" finds "100%". */
  keywords?: string;
  /** Offered for any typed text, after everything that actually matched ("Add component…"). */
  always?: boolean;
  /** Runs with whatever was typed, so an action can carry the text on. */
  run: (query: string) => void;
};

export type QuickTarget = { type: "node" | "group"; id: string; label: string };

export type QuickEntry =
  | { key: string; kind: "action"; action: QuickAction }
  | { key: string; kind: "component"; row: Row }
  | { key: string; kind: "goto"; target: QuickTarget };

export type QuickSection = { title: QuickGroup; entries: QuickEntry[] };

/** Components and Go to show this many matches each; Recent remembers this many. */
export const QUICK_LIMIT = 6;
export const RECENT_LIMIT = 5;

// The order sections take when their best matches tie.
const ORDER: QuickGroup[] = ["Recent", "Add", "Components", "Go to", "View", "Design"];

export const componentKey = (id: string) => `comp:${id}`;
export const targetKey = (t: Pick<QuickTarget, "type" | "id">) => `goto:${t.type}:${t.id}`;

/**
 * How well `text` answers the typed words: 0 when a word is missing. A word that starts the
 * text weighs most, one that starts any word in it next, anywhere else least; typing the whole
 * label exactly earns a bonus. `label` is the part the exact bonus compares against. The scale
 * is the picker's own (`score` in Palette.tsx), so a command, a component and a box that match
 * equally well tie, and a tie goes to the order Add, Components, Go to, View, Design: typing a
 * component's name and pressing Enter adds one even when the design already has one.
 */
export function textScore(text: string, words: string[], label = text): number {
  if (!words.length) return 1;
  const hay = text.toLowerCase();
  const tokens = hay.split(/[^a-z0-9%]+/).filter(Boolean);
  let s = 0;
  for (const w of words) {
    if (!hay.includes(w)) return 0;
    if (hay.startsWith(w)) s += 3;
    else if (tokens.some((t) => t.startsWith(w))) s += 2;
    else s += 1;
  }
  if (label.toLowerCase().replace(/[…"]/g, "").trim() === words.join(" ")) s += 2;
  return s;
}

/** Add the key to the front of the remembered list, once, and keep the newest few. */
export function pushRecent(recent: string[], key: string, limit = RECENT_LIMIT): string[] {
  return [key, ...recent.filter((k) => k !== key)].slice(0, limit);
}

export function quickSections({
  query,
  actions,
  rows,
  targets,
  recent = [],
}: {
  query: string;
  actions: QuickAction[];
  rows: Row[];
  targets: QuickTarget[];
  recent?: string[];
}): QuickSection[] {
  const { filters, words } = parseQuery(query);
  const typed = query.trim().length > 0;

  // An empty box: what this browser ran last, then every command in its group.
  if (!typed) {
    const byKey = new Map<string, QuickEntry>();
    for (const action of actions) byKey.set(action.id, { key: action.id, kind: "action", action });
    const rowsById = new Map(rows.map((r) => [r[0], r]));
    const resolve = (key: string): QuickEntry | null => {
      if (byKey.has(key)) return byKey.get(key) ?? null;
      if (key.startsWith("comp:")) {
        const row = rowsById.get(key.slice(5));
        return row ? { key, kind: "component", row } : null;
      }
      const target = targets.find((t) => targetKey(t) === key);
      return target ? { key, kind: "goto", target } : null;
    };
    const sections: QuickSection[] = [];
    const recents = recent
      .map(resolve)
      .filter((x): x is QuickEntry => Boolean(x))
      .slice(0, RECENT_LIMIT);
    if (recents.length) sections.push({ title: "Recent", entries: recents });
    for (const group of ["Add", "View", "Design"] as const) {
      const entries = actions
        .filter((a) => a.group === group)
        .map((action): QuickEntry => ({ key: action.id, kind: "action", action }));
      if (entries.length) sections.push({ title: group, entries });
    }
    return sections;
  }

  const scored: Array<{ title: QuickGroup; best: number; entries: QuickEntry[] }> = [];

  for (const group of ["Add", "View", "Design"] as const) {
    const hits: Array<[number, number, QuickEntry]> = [];
    actions.forEach((action, i) => {
      if (action.group !== group) return;
      const s = words.length
        ? textScore(`${action.label} ${action.keywords ?? ""}`, words, action.label)
        : 0;
      // An "always" action trails everything that really matched.
      const value = s || (action.always ? 0.5 : 0);
      if (value) hits.push([value, i, { key: action.id, kind: "action", action }]);
    });
    hits.sort((a, b) => b[0] - a[0] || a[1] - b[1]);
    if (hits.length)
      scored.push({ title: group, best: hits[0][0], entries: hits.map((h) => h[2]) });
  }

  // Components: the picker's own scoring, and its filters (provider:, kind:, category:).
  const phrase = words.join(" ");
  const comps: Array<[number, Row]> = [];
  for (const row of rows) {
    if (filters.provider && row[4] !== filters.provider) continue;
    if (filters.kind && row[2] !== filters.kind) continue;
    if (filters.category && row[3] !== filters.category) continue;
    const s = score(row, words);
    if (!s) continue;
    comps.push([s + (row[1].toLowerCase() === phrase ? 2 : 0), row]);
  }
  comps.sort(
    (a, b) =>
      b[0] - a[0] ||
      Number(isGeneric(b[1][0], b[1][2])) - Number(isGeneric(a[1][0], a[1][2])) ||
      a[1][1].localeCompare(b[1][1]),
  );
  if (comps.length)
    scored.push({
      title: "Components",
      best: comps[0][0],
      entries: comps
        .slice(0, QUICK_LIMIT)
        .map(([, row]): QuickEntry => ({ key: componentKey(row[0]), kind: "component", row })),
    });

  // Go to: the boxes already drawn, by what they are called and by id.
  if (words.length) {
    const hits: Array<[number, number, QuickTarget]> = [];
    targets.forEach((t, i) => {
      const s = textScore(`${t.label} ${t.id}`, words, t.label);
      if (s) hits.push([s, i, t]);
    });
    hits.sort((a, b) => b[0] - a[0] || a[1] - b[1]);
    if (hits.length)
      scored.push({
        title: "Go to",
        best: hits[0][0],
        entries: hits
          .slice(0, QUICK_LIMIT)
          .map(([, , target]): QuickEntry => ({ key: targetKey(target), kind: "goto", target })),
      });
  }

  scored.sort((a, b) => b.best - a.best || ORDER.indexOf(a.title) - ORDER.indexOf(b.title));
  return scored.map(({ title, entries }) => ({ title, entries }));
}
