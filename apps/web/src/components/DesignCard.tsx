import Link from "next/link";
import type { DesignSummary } from "@/lib/designs";
import { ownerSegment } from "@/lib/designs";
import type { Sketch } from "@/lib/sketch";

// Three thumbnail treatments, in order of preference: the brand mark of the product the design
// models, the engine's own layout as a mini-diagram, and a title plate for a design with nothing
// to draw yet.
function Thumb({ d }: { d: DesignSummary }) {
  if (d.brand)
    return (
      <div className="thumb-mark">
        <svg
          viewBox="0 0 24 24"
          role="img"
          aria-label={d.title}
          // biome-ignore lint/security/noDangerouslySetInnerHtml: brand mark from icons/providers
          dangerouslySetInnerHTML={{ __html: d.brand }}
        />
      </div>
    );
  if (d.sketch?.nodes.length) return <SketchSvg s={d.sketch} />;
  return <div className="thumb-plate">{d.title}</div>;
}

function SketchSvg({ s }: { s: Sketch }) {
  const pad = 24;
  return (
    <svg
      className="sketch"
      viewBox={`${-pad} ${-pad} ${s.w + pad * 2} ${s.h + pad * 2}`}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden
    >
      {s.frames.map(([x, y, w, h], i) => (
        <rect
          key={`f${i}`}
          x={x}
          y={y}
          width={w}
          height={h}
          rx={10}
          fill="none"
          stroke="var(--frame)"
          strokeWidth={2}
          strokeDasharray="8 6"
        />
      ))}
      {s.edges.map(([x1, y1, x2, y2, async], i) => (
        <line
          key={`e${i}`}
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke="var(--muted)"
          strokeWidth={2.5}
          strokeDasharray={async ? "9 6" : undefined}
        />
      ))}
      {s.nodes.map(([x, y, w, h, hue], i) => (
        <rect
          key={`n${i}`}
          x={x}
          y={y}
          width={w}
          height={h}
          rx={8}
          fill={`var(--t-${hue}-fill)`}
          stroke={`var(--t-${hue}-line)`}
          strokeWidth={2}
        />
      ))}
    </svg>
  );
}

export function DesignCard({ d }: { d: DesignSummary }) {
  const href = `/d/${ownerSegment(d.owner)}/${d.slug}`;
  return (
    <Link href={href} className="card no-underline">
      <div className="thumb">
        <Thumb d={d} />
      </div>
      <div className="card-body">
        <div className="medium">{d.title}</div>
        {d.summary ? <div className="small muted clamp-2">{d.summary}</div> : null}
        <div className="card-strip">
          <span>{d.owner ? `@${d.owner.username}` : "arkore"}</span>
          <span>·</span>
          <span>{d.nodeCount} components</span>
          {d.providers
            .filter((p) => p !== "default")
            .map((p) => (
              <span key={p} className="tag tag-mono">
                {p}
              </span>
            ))}
          {d.visibility === "private" ? (
            <span className="tag">private</span>
          ) : d.origin !== "authored" ? (
            <span className="tag">{d.origin}</span>
          ) : null}
          {d.unpublished && (d.visibility === "private" || d.owner) ? (
            <span className="tag tag-accent">draft</span>
          ) : null}
          <span className="ml-auto">{d.stats.cloneCount} clones</span>
        </div>
      </div>
    </Link>
  );
}
