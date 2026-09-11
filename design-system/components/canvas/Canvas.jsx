import React from "react";

/** The dotted drafting ground every node and edge is positioned against. */
export function Canvas({ height = 150, children, style, ...rest }) {
  return (
    <div
      style={{
        position: "relative",
        height,
        borderRadius: "var(--rp)",
        border: "var(--border) solid var(--line)",
        background:
          "radial-gradient(circle, var(--canvas-dot) 1px, transparent 1px) 0 0 / var(--canvas-dot-gap) var(--canvas-dot-gap), var(--bg)",
        overflow: "hidden",
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}
