import React from "react";

export function CanvasEdge({ x, y, length = 60, dashed = true, arrow = true, rotate = 0, color = "var(--muted)", style, ...rest }) {
  return (
    <span style={{ position: "absolute", left: x, top: y, transform: rotate ? `rotate(${rotate}deg)` : undefined, transformOrigin: "left center", ...style }} {...rest}>
      <span style={{ display: "block", width: length, borderTop: `1.2px ${dashed ? "dashed" : "solid"} ${color}` }} />
      {arrow && (
        <span style={{ position: "absolute", left: length, top: -4, width: 0, height: 0, borderLeft: `7px solid ${color}`, borderTop: "4px solid transparent", borderBottom: "4px solid transparent" }} />
      )}
    </span>
  );
}
