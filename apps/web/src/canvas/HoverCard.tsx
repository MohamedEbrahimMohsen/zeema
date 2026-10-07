"use client";

// The card the canvas shows beside the pointer when it rests on a component, an edge, or a group's label or border:
// the name, what it is, and the ids behind it. It replaces the native <title> tooltip, which is
// slow to come and cannot be styled. It never takes the pointer: it is a remark, not a control.
import { nodeCountOf, nodeLines } from "@zeema/core/document";
import { useLayoutEffect, useRef } from "react";
import { edgeCrossings, edgesText, memberCounts, membersText, parentPath } from "./group-info";

export type HoverAt = { type: "node" | "group" | "edge"; id: string; x: number; y: number };

const own = (o: any, k: unknown) =>
  o != null && typeof k === "string" && Object.hasOwn(o, k) ? o[k] : undefined;

export function HoverCard({ at, doc, catalogue }: { at: HoverAt; doc: any; catalogue: any }) {
  const ref = useRef<HTMLDivElement>(null);
  // Beside the pointer, flipped to the other side where the window would cut it off.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const gap = 14;
    let left = at.x + gap;
    let top = at.y + gap + 4;
    if (left + r.width > window.innerWidth - 8) left = at.x - gap - r.width;
    if (top + r.height > window.innerHeight - 8) top = at.y - gap - r.height;
    el.style.left = `${Math.max(8, left)}px`;
    el.style.top = `${Math.max(8, top)}px`;
  }, [at]);

  const row = (label: string, value: React.ReactNode, cls = "") => (
    <>
      <span className="hc-label">{label}</span>
      <span className={`hc-value${cls ? ` ${cls}` : ""}`}>{value}</span>
    </>
  );
  let body: React.ReactNode = null;
  if (at.type === "node") {
    const n = doc.nodes.find((x: any) => x.id === at.id);
    if (!n) return null;
    const lines = nodeLines(catalogue, n);
    const comp = own(catalogue.components, n.component);
    const kindName = comp ? own(catalogue.locale?.kinds, comp.kind)?.name || comp.kind : "";
    const product = own(catalogue.locale?.components, n.component)?.name || n.component;
    const provider = comp?.provider && comp.provider !== "default" ? comp.provider : null;
    // N identical copies, in the property's own word: "3 instances", "8 shards", "2 replicas".
    // The catalogue has no display names for properties, and these three are already words.
    const count = nodeCountOf(doc, n, catalogue);
    body = (
      <>
        {row("Name", lines.name, "hc-name")}
        {lines.name !== product ? row("Product", product) : null}
        {kindName ? row("Kind", kindName) : null}
        {provider
          ? row("Provider", own(catalogue.locale?.providers, provider)?.name || provider)
          : null}
        {count ? row("Count", `${count.count} ${count.prop}`) : null}
        <span className="hc-rule" />
        {row("Id", `${n.id} · ${n.component}`, "hc-mono")}
      </>
    );
  } else if (at.type === "edge") {
    // An edge: its words, its ends, how it is called and how it authenticates.
    const e = (doc.edges || [])[Number(at.id)];
    if (!e) return null;
    const end = (id: string) => {
      const n = doc.nodes.find((x: any) => x.id === id);
      return n ? nodeLines(catalogue, n).name : id;
    };
    const auth = e.auth ? own(catalogue.locale?.edgeAuth, e.auth)?.name || e.auth : null;
    body = (
      <>
        {row("Name", e.label || `${end(e.from)} → ${end(e.to)}`, "hc-name")}
        {e.label ? row("Ends", `${end(e.from)} → ${end(e.to)}`) : null}
        {row("Protocol", `${e.protocol} · ${e.mode}${e.delivery ? ` · ${e.delivery}` : ""}`)}
        {auth ? row("Auth", auth) : null}
        <span className="hc-rule" />
        {row("Id", `${e.from} → ${e.to}`, "hc-mono")}
      </>
    );
  } else {
    const g = (doc.groups || []).find((x: any) => x.id === at.id);
    if (!g) return null;
    const path = parentPath(doc, g.id);
    const edges = edgesText(edgeCrossings(doc, g.id));
    body = (
      <>
        {row("Name", g.label || g.id, "hc-name")}
        {row("Kind", own(catalogue.locale?.groupKinds, g.kind)?.name || g.kind)}
        {path.length ? row("Parent", path.join(" › ")) : null}
        {row("Members", membersText(memberCounts(doc, g.id)))}
        {edges ? row("Edges", edges) : null}
        <span className="hc-rule" />
        {row("Id", g.id, "hc-mono")}
      </>
    );
  }
  return (
    <div className="hover-card" ref={ref} role="tooltip" style={{ left: at.x, top: at.y }}>
      {body}
    </div>
  );
}
