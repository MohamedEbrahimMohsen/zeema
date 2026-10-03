// What a group's hover card says about it beyond its name: where it sits, what it holds and how
// much crosses its border. Pure functions over the document, so the card and the tests agree.
import { groupMembers } from "@zeema/core/document";

type Group = { id: string; kind?: string; label?: string; parent?: string };

const groupsOf = (doc: any): Group[] => doc.groups || [];
const nameOf = (g: Group) => (g.label ? String(g.label) : g.id);

/** The group and every group inside it, at any depth. */
export function groupAndDescendants(doc: any, groupId: string): Set<string> {
  const out = new Set([groupId]);
  for (let grew = true; grew; ) {
    grew = false;
    for (const g of groupsOf(doc))
      if (g.parent && out.has(g.parent) && !out.has(g.id)) {
        out.add(g.id);
        grew = true;
      }
  }
  return out;
}

/** The names of the groups above this one, outermost first. Empty for a top-level group. */
export function parentPath(doc: any, groupId: string): string[] {
  const groups = groupsOf(doc);
  const path: string[] = [];
  const seen = new Set([groupId]);
  let walk = groups.find((g) => g.id === groupId);
  while (walk?.parent && !seen.has(walk.parent)) {
    seen.add(walk.parent);
    const up = groups.find((g) => g.id === walk?.parent);
    if (!up) break;
    path.unshift(nameOf(up));
    walk = up;
  }
  return path;
}

/** Direct components and child groups, and every component inside at any depth. */
export function memberCounts(doc: any, groupId: string) {
  return {
    components: doc.nodes.filter((n: any) => n.group === groupId).length,
    groups: groupsOf(doc).filter((g) => g.parent === groupId).length,
    nested: groupMembers(doc, groupId).length,
  };
}

/**
 * Edges crossing this frame's border: one end inside (a member at any depth, the group itself
 * or a group inside it), the other outside.
 */
export function edgeCrossings(doc: any, groupId: string) {
  const inside = groupAndDescendants(doc, groupId);
  for (const id of groupMembers(doc, groupId)) inside.add(id);
  let into = 0;
  let out = 0;
  for (const e of doc.edges || []) {
    const from = inside.has(e.from);
    const to = inside.has(e.to);
    if (to && !from) into++;
    if (from && !to) out++;
  }
  return { in: into, out };
}

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

/** "7 components · 2 groups", with " · 12 nested" when there are components further in. */
export function membersText(c: { components: number; groups: number; nested: number }) {
  const parts = [plural(c.components, "component"), plural(c.groups, "group")];
  if (c.nested !== c.components) parts.push(`${c.nested} nested`);
  return parts.join(" · ");
}

/** "3 in · 2 out", or null when nothing crosses. */
export function edgesText(c: { in: number; out: number }) {
  return c.in || c.out ? `${c.in} in · ${c.out} out` : null;
}

type Box = [number, number, number, number];

/** The group's parent, its parent's parent and so on, innermost first. Stops on a cycle. */
export function ancestorsOf(doc: any, groupId: string | null): string[] {
  const groups = groupsOf(doc);
  const out: string[] = [];
  let walk = groupId;
  while (walk && !out.includes(walk)) {
    out.push(walk);
    walk = groups.find((g) => g.id === walk)?.parent ?? null;
  }
  return out;
}

/**
 * Where a dragged item let go at (x, y) goes: `{ group }` to move it (`group: null` is the top
 * level), or null to leave its grouping alone. `ancestors` is the group it is in now, then that
 * group's parent, and so on (empty at the top level). `skip` is what is being dragged and
 * everything inside it. `frames` are the frames as they were when the drag began, so a parent
 * stretching after its member is not read as the member still being in it.
 *
 * A plain drag never lets an ancestor capture the item: nudged past its own frame's edge it stays
 * put and the frame stretches. Only a frame outside its chain (a sibling, a cousin, an unrelated
 * group, a group inside its own) takes it. Shift is "take it out": the innermost frame under the
 * point, whatever it is, or the top level over empty canvas.
 */
export function regroupTarget(
  frames: Record<string, Box>,
  x: number,
  y: number,
  skip: Set<string>,
  ancestors: string[],
  shift = false,
): { group: string | null } | null {
  let best: string | null = null;
  let area = Number.POSITIVE_INFINITY;
  for (const [id, f] of Object.entries(frames)) {
    if (skip.has(id)) continue;
    if (x < f[0] || x > f[0] + f[2] || y < f[1] || y > f[1] + f[3]) continue;
    const a = f[2] * f[3];
    if (a < area) {
      best = id;
      area = a;
    }
  }
  const current = ancestors[0] ?? null;
  if (best === current) return null;
  if (shift) return { group: best };
  return best && !ancestors.includes(best) ? { group: best } : null;
}
