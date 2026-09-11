import React from "react";

export function Boundary({ label, inset = 10, children, style, ...rest }) {
  return (
    <>
      <div
        style={{ position: "absolute", left: inset + 2, top: inset, right: inset + 2, bottom: inset, border: "var(--border) dashed var(--frame)", borderRadius: "calc(var(--rp) + 2px)", pointerEvents: "none", ...style }}
        {...rest}
      />
      {label && (
        <span style={{ position: "absolute", left: inset + 10, top: inset + 2, fontSize: "var(--fs-micro)", fontFamily: "var(--mono)", color: "var(--muted)" }}>
          {label}
        </span>
      )}
      {children}
    </>
  );
}
