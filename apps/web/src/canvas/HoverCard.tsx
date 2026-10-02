"use client";

// The card the canvas shows beside the pointer when it rests on a component or a group's label:
// the name, what it is, and the ids behind it. It replaces the native <title> tooltip, which is
// slow to come and cannot be styled. It never takes the pointer: it is a remark, not a control.
import { nodeLines } from "@zeema/core/document";
import { useLayoutEffect, useRef } from "react";

export type HoverAt = { type: "node" | "group"; id: string; x: number; y: number };

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

  let body: React.ReactNode = null;
  if (at.type === "node") {
    const n = doc.nodes.find((x: any) => x.id === at.id);
    if (!n) return null;
    const lines = nodeLines(catalogue, n);
    const comp = own(catalogue.components, n.component);
    const kindName = comp ? own(catalogue.locale?.kinds, comp.kind)?.name || comp.kind : "";
    const product = own(catalogue.locale?.components, n.component)?.name || n.component;
    const what = [n.label ? product : null, kindName].filter(Boolean).join(" · ");
    const provider = comp?.provider && comp.provider !== "default" ? comp.provider : null;
    body = (
      <>
        <div className="hc-name">{lines.name}</div>
        {what ? <div className="hc-what">{what}</div> : null}
        <div className="hc-ids">
          <span>
            {n.id} · {n.component}
          </span>
          {provider ? (
            <span className="hc-chip">
              {own(catalogue.locale?.providers, provider)?.name || provider}
            </span>
          ) : null}
        </div>
      </>
    );
  } else {
    const g = (doc.groups || []).find((x: any) => x.id === at.id);
    if (!g) return null;
    body = (
      <>
        <div className="hc-name">{g.label || g.id}</div>
        <div className="hc-what">{g.kind}</div>
        <div className="hc-ids">
          <span>{g.id}</span>
        </div>
      </>
    );
  }
  return (
    <div className="hover-card" ref={ref} role="tooltip" style={{ left: at.x, top: at.y }}>
      {body}
    </div>
  );
}
