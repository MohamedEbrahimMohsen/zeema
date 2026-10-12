// What the canvas lights: a component's neighbourhood (hover, a click's pin) and its flow (the
// lens: every component and edge that reaches it, or that it reaches). Pure functions over the
// document. An edge end that names a group stands for every node inside the group, nested groups
// included, which is how the rules read it too (`expandGroupEdges` in @zeema/core/rules). An end
// naming a module (`node/module`) is its node; the lens itself, a network trace, never walks an
// in-process edge (expandGroupEdges leaves those out).
import { endNode } from "@zeema/core/document";
import { expandGroupEdges, membersByGroup } from "@zeema/core/rules";

export type Lit = { nodes: Set<string>; edges: Set<number> };

// Ids that name a group and no node: an end there is the group as a unit.
const groupEnds = (doc: any): Set<string> => {
  const nodes = new Set((doc?.nodes ?? []).map((n: any) => n?.id));
  return new Set(
    (doc?.groups ?? []).map((g: any) => g?.id).filter((id: unknown) => !nodes.has(id)),
  );
};

/**
 * Edge indices by the node they touch, both ways: an edge to a group touches each of its members.
 * A node's neighbourhood is its entry here.
 */
export function adjacencyOf(doc: any): Map<string, number[]> {
  const ends = groupEnds(doc);
  const members = membersByGroup(doc) as Map<string, string[]>;
  const out = new Map<string, number[]>();
  const add = (id: string, i: number) => {
    const list = out.get(id);
    if (!list) out.set(id, [i]);
    else if (list[list.length - 1] !== i) list.push(i);
  };
  (doc?.edges ?? []).forEach((e: any, i: number) => {
    for (const end of [endNode(e?.from), endNode(e?.to)])
      if (ends.has(end)) for (const m of members.get(end) ?? []) add(m, i);
      else if (typeof end === "string") add(end, i);
  });
  return out;
}

/** The nodes an edge end stands for: the node, or every node inside the group. */
export function nodesAt(doc: any, end: string): string[] {
  const id = endNode(end);
  if (!groupEnds(doc).has(id)) return [id];
  return (membersByGroup(doc) as Map<string, string[]>).get(id) ?? [];
}

/**
 * The flow lens from one component: everything upstream of it (walk incoming edges back, as far
 * as they go), or, for a component nothing points at (a source, such as a client), everything
 * downstream of it. `direction` says which was walked; a component with no edges at all lights
 * alone, `direction` null.
 */
export function flowFrom(doc: any, id: string): Lit & { direction: "up" | "down" | null } {
  const { flat, from } = expandGroupEdges(doc ?? {}, groupEnds(doc)) as {
    flat: { edges: any[] };
    from: number[];
  };
  const into = new Map<string, Array<[string, number]>>();
  const out = new Map<string, Array<[string, number]>>();
  flat.edges.forEach((e: any, k: number) => {
    if (!e || typeof e.from !== "string" || typeof e.to !== "string") return;
    const push = (m: Map<string, Array<[string, number]>>, key: string, v: [string, number]) => {
      const list = m.get(key);
      if (list) list.push(v);
      else m.set(key, [v]);
    };
    push(into, e.to, [e.from, from[k]]);
    push(out, e.from, [e.to, from[k]]);
  });
  const direction = into.has(id) ? "up" : out.has(id) ? "down" : null;
  const nodes = new Set([id]);
  const edges = new Set<number>();
  if (!direction) return { nodes, edges, direction };
  const step = direction === "up" ? into : out;
  const queue = [id];
  while (queue.length) {
    const cur = queue.shift() as string;
    for (const [next, i] of step.get(cur) ?? []) {
      edges.add(i);
      if (!nodes.has(next)) {
        nodes.add(next);
        queue.push(next);
      }
    }
  }
  return { nodes, edges, direction };
}
