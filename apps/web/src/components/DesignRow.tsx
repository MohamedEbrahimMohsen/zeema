import Link from "next/link";
import type { DesignSummary } from "@/lib/designs";
import { ownerSegment } from "@/lib/designs";
import type { Theme } from "@/lib/theme";
import { Canvas } from "./Glyphs";

// The browse listing is a table of designs rather than a wall of cards: at this density the
// numbers line up down the page, so one design can be compared against the next. Browse and
// profiles both use it.

// The drawing is the engine's own SVG (icons, tints, the layout as drawn), fetched as an image
// so the browser caches it by its thumb key rather than every listing re-drawing it inline.
// `data-thumb` lets ThemeToggle swap the theme without a reload.
function Thumb({ d, theme }: { d: DesignSummary; theme: Theme }) {
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
  if (d.thumb) {
    const q = new URLSearchParams({ version: d.thumb.version, v: d.thumb.key, theme });
    const src = `/api/v1/designs/${ownerSegment(d.owner)}/${d.slug}/thumb?${q}`;
    // Two layers of the one URL (one request): the top of the drawing at a readable scale, and
    // the whole drawing, which fades in over it on row hover. object-fit itself cannot animate.
    return (
      <>
        <img
          className="row-img"
          data-thumb
          src={src}
          loading="lazy"
          decoding="async"
          width={176}
          height={110}
          alt=""
        />
        <img
          className="row-img row-img-whole"
          data-thumb
          src={src}
          loading="lazy"
          decoding="async"
          width={176}
          height={110}
          alt=""
          aria-hidden
        />
      </>
    );
  }
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
export function DesignRow({ d, theme }: { d: DesignSummary; theme: Theme }) {
  const owner = ownerSegment(d.owner);
  const clean = d.findingCount === 0;
  return (
    <li className="row-item">
      <Link href={`/d/${owner}/${d.slug}`} className="row no-underline">
        <div className="row-thumb">
          <Thumb d={d} theme={theme} />
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
