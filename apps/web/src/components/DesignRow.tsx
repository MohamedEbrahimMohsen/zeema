import Link from "next/link";
import type { DesignSummary } from "@/lib/designs";
import { ownerSegment } from "@/lib/designs";
import { Canvas } from "./Glyphs";
import { SketchSvg } from "./Sketch";

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

const CloneIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
    <rect x="8" y="8" width="12" height="12" rx="2" />
    <path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" />
  </svg>
);

// The row's one quick action, "Open in canvas", is a sibling of the row's link rather than a
// child (an anchor may not hold another), laid over the last grid column, which the row keeps
// empty for it. It shows on hover and focus-within, and always where there is no hover.
export function DesignRow({ d }: { d: DesignSummary }) {
  const owner = ownerSegment(d.owner);
  const clean = d.findingCount === 0;
  return (
    <li className="row-item">
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
        <span className="row-act-slot" aria-hidden />
      </Link>
      <a
        className="row-act no-underline"
        href={`/d/${owner}/${d.slug}/canvas`}
        aria-label={`Open ${d.title} in canvas`}
        title="Open in canvas"
      >
        <Canvas />
      </a>
    </li>
  );
}
