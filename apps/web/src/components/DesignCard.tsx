import Link from "next/link";
import type { DesignSummary } from "@/lib/designs";
import { ownerSegment } from "@/lib/designs";
import { SketchSvg } from "./Sketch";

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
          <span>{d.owner ? `@${d.owner.username}` : "zeema"}</span>
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
