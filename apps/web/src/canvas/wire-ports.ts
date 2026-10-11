// What an edge drawn from a port dot stores. The dot says which side to leave from; the wire is
// let go somewhere on the target. Stored, both are ports, and a ported end bundles only with ends
// ported to the same point (core routing.js, "Trunks"), so a wire drawn from the dot at the side
// the edge leaves by anyway would sit beside the bundle already on that side instead of joining
// it. Such a wire stores no port: the edge is placed as if it had been drawn from the box, and
// a port matters only once someone moves an end. The dot is kept when it chose another side, or
// when an edge already leaves the box pinned to that dot (wires drawn from one dot bundle).

import type { EdgePorts, Port, PortSide } from "@/lib/layout-sidecar";

type Box = [number, number, number, number];
type Point = [number, number];

/** The side of a box a drawn end point lies on: the border nearest it. */
export function sideAt([x, y, w, h]: Box, [px, py]: Point): PortSide {
  const gaps: [PortSide, number][] = [
    ["top", Math.abs(py - y)],
    ["right", Math.abs(px - (x + w))],
    ["bottom", Math.abs(py - (y + h))],
    ["left", Math.abs(px - x)],
  ];
  return gaps.reduce((p, q) => (q[1] < p[1] ? q : p))[0];
}

export const samePort = (p: Port | null | undefined, q: Port | null | undefined) =>
  !!p && !!q && p.side === q.side && p.t === q.t;

/**
 * The ports to store for a wire drawn from a port dot, or undefined for none.
 * @param ends    the dot (its side, t 0.5) and where the wire was let go on the target
 * @param auto    the new edge as it is drawn with no ports: its two boxes and end points; null
 *                when there is no such drawing (curved edges have no sides to compare)
 * @param pinned  whether another edge already leaves the source from the same dot
 */
export function wirePorts(
  ends: EdgePorts,
  auto: { a: Box; b: Box; start: Point; end: Point } | null,
  pinned: boolean,
): EdgePorts | undefined {
  if (!auto || !ends.from || pinned || ends.from.side !== sideAt(auto.a, auto.start)) return ends;
  // The dot changed nothing. Where the wire was let go is kept only when it chose another side
  // of the target than the edge would meet anyway.
  if (ends.to && ends.to.side !== sideAt(auto.b, auto.end)) return { to: ends.to };
  return undefined;
}
