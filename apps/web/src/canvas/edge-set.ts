// Edges as a set: what a sweep picks, and what one Inspector card for several edges shows.
// Pure: no DOM. The sweep reads the geometry the scene already holds for the run (`edgeGeometry`
// in @zeema/core/geometry), never a bounding box measured off the page.

/** The part of an edge's geometry these read: its ends, and the points its path is drawn from. */
export interface EdgeShape {
  i: number;
  from: string;
  to: string;
  points: number[][];
  /** A polyline through `points`; otherwise `points` are a curve's (see `pathOf`). */
  ortho?: boolean;
}

/** A sweep rectangle in world coordinates: [left, top, right, bottom]. */
export type Rect = [number, number, number, number];

// How many points along each curve are tested. A curve's drawn line is checked, not its control
// points, which can sit well outside a gentle bow.
const SAMPLES = 16;

function quad(a: number[], c: number[], b: number[], t: number) {
  const u = 1 - t;
  return [
    u * u * a[0] + 2 * u * t * c[0] + t * t * b[0],
    u * u * a[1] + 2 * u * t * c[1] + t * t * b[1],
  ];
}

function cubic(a: number[], c1: number[], c2: number[], b: number[], t: number) {
  const u = 1 - t;
  const k = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
  return [
    k[0] * a[0] + k[1] * c1[0] + k[2] * c2[0] + k[3] * b[0],
    k[0] * a[1] + k[1] * c1[1] + k[2] * c2[1] + k[3] * b[1],
  ];
}

/** Points on the line an edge is drawn as, from its source port to its target port. */
export function pathPoints(e: EdgeShape): number[][] {
  const p = e.points;
  if (e.ortho || p.length === 2) return p;
  const out: number[][] = [];
  for (let s = 0; s <= SAMPLES; s++) {
    const t = s / SAMPLES;
    if (p.length === 3) out.push(quad(p[0], p[1], p[2], t));
    else if (p.length === 7)
      out.push(cubic(p[0], p[1], p[2], p[3], t), cubic(p[3], p[4], p[5], p[6], t));
    else return p;
  }
  return out;
}

const inside = ([x, y]: number[], r: Rect) => x >= r[0] && x <= r[2] && y >= r[1] && y <= r[3];

/**
 * The edges whose whole drawn path lies inside `rect`. A polyline is inside when every corner is
 * (the rectangle is convex, so every run between two corners inside it is too).
 */
export function edgesInsideRect(geom: readonly EdgeShape[], rect: Rect): number[] {
  return geom
    .filter((e) => e.points.length && pathPoints(e).every((p) => inside(p, rect)))
    .map((e) => e.i);
}

/**
 * What a sweep picks besides components: every edge drawn wholly inside it, and every edge whose
 * both ends are among the components it picked.
 */
export function sweptEdges(
  geom: readonly EdgeShape[],
  rect: Rect,
  nodes: ReadonlySet<string>,
): number[] {
  const wholly = new Set(edgesInsideRect(geom, rect));
  return geom
    .filter((e) => wholly.has(e.i) || (nodes.has(e.from) && nodes.has(e.to)))
    .map((e) => e.i);
}

/**
 * One field across a set: its value when every one of them has the same (unset counts as a value),
 * and `mixed` when they differ.
 */
export function mixedValue<T>(values: readonly T[]): { value: T | undefined; mixed: boolean } {
  if (!values.length) return { value: undefined, mixed: false };
  const first = values[0];
  const mixed = values.some((v) => v !== first);
  return { value: mixed ? undefined : first, mixed };
}
