"use client";

// The card the canvas shows beside the pointer when it rests on a component, an edge, or a group's label or border:
// the name, what it is, and the ids behind it. It replaces the native <title> tooltip, which is
// slow to come and cannot be styled. It never takes the pointer: it is a remark, not a control.
import { nodeCountOf, nodeLines } from "@zeema/core/document";
import { useLayoutEffect, useRef } from "react";
import { edgeCrossings, edgesText, memberCounts, membersText, parentPath } from "./group-info";
import { pinnedRelease, type RefEntry, type RefVersion, refState } from "./ref-state";

export type HoverAt = { type: "node" | "group" | "edge" | "ref"; id: string; x: number; y: number };

/**
 * A node's reference and what the summary route said about it, for the "ref" card; `unset` for
 * a Zeema design box that names no design yet.
 */
export type RefInfo =
  | { owner: string; slug: string; version: RefVersion; entry?: RefEntry }
  | { unset: true };

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const day = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "";

const own = (o: any, k: unknown) =>
  o != null && typeof k === "string" && Object.hasOwn(o, k) ? o[k] : undefined;

export function HoverCard({
  at,
  doc,
  catalogue,
  refInfo,
  refName,
  theme = "light",
}: {
  at: HoverAt;
  doc: any;
  catalogue: any;
  /** The reference of the node under a "ref" hover (its disc), with its summary. */
  refInfo?: (nodeId: string) => RefInfo | null;
  /** The resolved name of the design a subsystem box references (nodeLines' `refName`). */
  refName?: (node: any) => string | null;
  theme?: string;
}) {
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
  if (at.type === "ref") {
    // The disc of a node standing for another design: that design, as the summary route sees it.
    const info = refInfo?.(at.id);
    if (!info) return null;
    // A Zeema design box before its pick: the disc is a prompt, and says so.
    if ("unset" in info)
      return (
        <div className="hover-card" ref={ref} role="tooltip" style={{ left: at.x, top: at.y }}>
          <span className="hc-value hc-wide">No design chosen</span>
        </div>
      );
    const { entry, version } = info;
    const state = refState(entry, version);
    if (state === "unreachable")
      body = <span className="hc-value hc-wide">Design not available</span>;
    else if (entry?.status !== "ok")
      body = (
        <>
          {row("Design", `${info.owner}/${info.slug}`, "hc-mono")}
          <span className="hc-value hc-wide muted">Checking…</span>
        </>
      );
    else {
      const s = entry.summary;
      const pinned = pinnedRelease(entry, version);
      const release = pinned
        ? `release v${pinned.version}${pinned.publishedAt ? ` · ${day(pinned.publishedAt)}` : ""}`
        : version === "head"
          ? "not released yet"
          : `v${version} · not released`;
      const thumb = pinned
        ? (version === "head" || pinned.version === s.latest) && s.thumb
          ? s.thumb
          : `/api/v1/designs/${encodeURIComponent(s.owner)}/${encodeURIComponent(s.slug)}/thumb?version=${encodeURIComponent(pinned.id)}`
        : null;
      body = (
        <>
          {row("Design", s.name, "hc-name")}
          {row("Owner", s.owner)}
          {row(
            "Release",
            <>
              {version === "head" ? `${release} · follows latest` : release}
              {state === "newer" && s.latest ? (
                <span className="hc-pill">v{s.latest} available</span>
              ) : null}
            </>,
          )}
          {row(
            "Size",
            `${plural(s.counts.nodes, "node")} · ${plural(s.counts.edges, "edge")}${s.counts.groups ? ` · ${plural(s.counts.groups, "group")}` : ""}`,
          )}
          {thumb ? (
            <img
              className="hc-thumb"
              src={`${thumb}&theme=${theme === "dark" ? "dark" : "light"}`}
              alt=""
            />
          ) : null}
          <span className="hc-rule" />
          {row(
            "Ref",
            `${info.owner}/${info.slug}@${version === "head" ? "head" : `v${version}`}`,
            "hc-mono",
          )}
        </>
      );
    }
  } else if (at.type === "node") {
    const n = doc.nodes.find((x: any) => x.id === at.id);
    if (!n) return null;
    const lines = nodeLines(catalogue, n, refName?.(n) ?? null);
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
      return n ? nodeLines(catalogue, n, refName?.(n) ?? null).name : id;
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
