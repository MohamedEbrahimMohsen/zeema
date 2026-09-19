import Link from "next/link";
import type { DesignSummary } from "@/lib/designs";
import { ownerSegment } from "@/lib/designs";
import type { Sketch } from "@/lib/sketch";

// The browse listing is a table of designs rather than a wall of cards: at this density the
// numbers line up down the page, so one design can be compared against the next. The card
// treatment stays on the home page and profiles, where there are only a handful to show.

function Thumb({ d }: { d: DesignSummary }) {
  if (d.brand)
    return (
      <div className="row-mark">
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
  return <div className="row-plate">{d.title.slice(0, 2)}</div>;
}

function SketchSvg({ s }: { s: Sketch }) {
  const pad = 24;
  return (
    <svg
      viewBox={`${-pad} ${-pad} ${s.w + pad * 2} ${s.h + pad * 2}`}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden
    >
      {s.edges.map(([x1, y1, x2, y2], i) => (
        <line
          key={`e${i}`}
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke="var(--muted)"
          strokeOpacity={0.45}
          strokeWidth={3}
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
          strokeWidth={2.5}
        />
      ))}
    </svg>
  );
}

const CloneIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
    <rect x="8" y="8" width="12" height="12" rx="2" />
    <path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" />
  </svg>
);

export function DesignRow({ d }: { d: DesignSummary }) {
  const owner = ownerSegment(d.owner);
  const clean = d.findingCount === 0;
  return (
    <li>
      <Link href={`/d/${owner}/${d.slug}`} className="row no-underline">
        <div className="row-thumb">
          <Thumb d={d} />
        </div>
        <div className="row-name">
          <strong>{d.title}</strong>
          <span className="row-slug">
            {owner}/{d.slug}
          </span>
          <span className="row-tags">
            {d.providers
              .filter((p) => p !== "default")
              .map((p) => (
                <span key={p} className="tag tag-mono">
                  {p}
                </span>
              ))}
            <span className={`tag tag-mono${d.origin === "reference" ? " tag-accent" : ""}`}>
              {d.origin}
            </span>
            {d.visibility === "private" ? <span className="tag">private</span> : null}
            {d.unpublished && (d.visibility === "private" || d.owner) ? (
              <span className="tag tag-accent">draft</span>
            ) : null}
          </span>
        </div>
        <div className="row-meta">
          <span className="row-num">
            {d.nodeCount}
            <small> components</small>
          </span>
          <span className="row-num">
            {d.edgeCount}
            <small> edges</small>
          </span>
          <span className={`row-find${clean ? " is-ok" : " is-warn"}`}>
            {clean
              ? "✓ 0 findings"
              : `⚠ ${d.findingCount} finding${d.findingCount === 1 ? "" : "s"}`}
          </span>
          <span
            className="row-clones"
            title={`${d.stats.cloneCount} clone${d.stats.cloneCount === 1 ? "" : "s"}`}
          >
            <CloneIcon />
            {d.stats.cloneCount}
          </span>
        </div>
      </Link>
    </li>
  );
}
