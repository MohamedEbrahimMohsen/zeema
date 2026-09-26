import type { Sketch } from "@/lib/sketch";

// The engine's layout drawn as a mini-diagram, shared by the browse rows and the cards. A tall
// design is shrunk hard to fit a thumbnail, so strokes are held at screen pixels
// (non-scaling-stroke; dashes follow suit) rather than scaled with the drawing. Everything is
// tinted with the accent (the --sketch-* tokens), except a group that carries its own tint in
// the sidecar: that frame is drawn in its colour, filled faintly.
const NSS = "non-scaling-stroke";

/** A named tint is a theme token; a hex one is used as it is, as on the canvas. */
const tintColour = (t: string) => (t.startsWith("#") ? t : `var(--tint-${t})`);

export function SketchSvg({ s }: { s: Sketch }) {
  const pad = 24;
  return (
    <svg
      className="sketch"
      viewBox={`${-pad} ${-pad} ${s.w + pad * 2} ${s.h + pad * 2}`}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden
    >
      {s.frames.map(([x, y, w, h, tint], i) => (
        <rect
          key={`f${i}`}
          x={x}
          y={y}
          width={w}
          height={h}
          rx={14}
          style={
            tint
              ? {
                  fill: `color-mix(in srgb, ${tintColour(tint)} 10%, transparent)`,
                  stroke: `color-mix(in srgb, ${tintColour(tint)} 60%, transparent)`,
                }
              : { fill: "none", stroke: "var(--sketch-frame-line)" }
          }
          strokeWidth={1}
          strokeDasharray="3 2"
          vectorEffect={NSS}
        />
      ))}
      {s.edges.map(([x1, y1, x2, y2, async], i) => (
        <line
          key={`e${i}`}
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke="var(--sketch-edge)"
          strokeWidth={1}
          strokeDasharray={async ? "3 2" : undefined}
          vectorEffect={NSS}
        />
      ))}
      {s.nodes.map(([x, y, w, h, hole], i) => (
        <rect
          key={`n${i}`}
          x={x}
          y={y}
          width={w}
          height={h}
          rx={12}
          fill="var(--sketch-node-fill)"
          stroke="var(--sketch-node-line)"
          strokeWidth={1}
          strokeDasharray={hole ? "3 2" : undefined}
          fillOpacity={hole ? 0.45 : undefined}
          vectorEffect={NSS}
        />
      ))}
    </svg>
  );
}
