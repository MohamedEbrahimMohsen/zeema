import Link from "next/link";
import type { DesignSummary } from "@/lib/designs";
import { ownerSegment } from "@/lib/designs";

export function DesignCard({ d }: { d: DesignSummary }) {
  const href = `/d/${ownerSegment(d.owner)}/${d.slug}`;
  return (
    <Link href={href} className="panel block p-4 no-underline hover:shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-medium leading-tight">{d.title}</h3>
        {d.visibility === "private" ? (
          <span className="tag">private</span>
        ) : d.origin !== "authored" ? (
          <span className="tag">{d.origin}</span>
        ) : null}
      </div>
      <p className="muted mt-1 line-clamp-2 text-sm">{d.summary ?? "No summary yet."}</p>
      <div className="muted mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <span>{d.owner ? `@${d.owner.username}` : "arkore"}</span>
        <span>{d.nodeCount} components</span>
        {d.providers
          .filter((p) => p !== "default")
          .map((p) => (
            <span key={p} className="tag">
              {p}
            </span>
          ))}
        <span className="ml-auto">
          {d.stats.cloneCount} clones · {d.stats.exportCount} exports
        </span>
      </div>
    </Link>
  );
}
