// Components as a set: which kind properties one Inspector card for several of them can show,
// and what each shows. Pure: no DOM. The definitions come from `propDefs` in @zeema/core/document.
import { mixedValue } from "./edge-set";

/** A property definition as the catalogue states it (kind or component). */
export interface PropDef {
  type: string;
  values?: string[];
  default?: unknown;
  required?: boolean;
  advanced?: boolean;
}

const sameValues = (a: readonly string[] = [], b: readonly string[] = []) =>
  a.length === b.length && [...a].sort().join("\u0000") === [...b].sort().join("\u0000");

const sameShape = (a: PropDef, b: PropDef) =>
  a.type === b.type && (a.type !== "enum" || sameValues(a.values, b.values));

/**
 * The properties every one of `defs` declares under the same id with the same type (and, for an
 * enum, the same set of values), in the first one's order, with the first one's definition. One
 * kind across the set: all of its properties. Nothing given: nothing in common.
 */
export function commonProps(defs: readonly Record<string, PropDef>[]): [string, PropDef][] {
  if (!defs.length) return [];
  const [first, ...rest] = defs;
  return Object.entries(first).filter(([name, def]) =>
    rest.every((d) => Object.hasOwn(d, name) && sameShape(def, d[name])),
  );
}

/**
 * One property across the set, the way the single card shows it: `value` is what the nodes set
 * themselves (shared, or undefined), `resolved` the value they fall back to when that is shared,
 * and `mixed` when they disagree on either.
 */
export function propValue(
  own: readonly unknown[],
  resolved: readonly unknown[],
): { value: unknown; resolved: unknown; mixed: boolean } {
  const set = mixedValue(own);
  const eff = mixedValue(resolved);
  return { value: set.value, resolved: eff.value, mixed: set.mixed || eff.mixed };
}
