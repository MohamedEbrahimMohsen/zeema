import React from "react";

export function FindingsPanel({ errors = 0, warnings = 0, info = 0, children, style, ...rest }) {
  return (
    <div
      style={{ background: "var(--panel)", border: "var(--border) solid var(--line)", borderRadius: "var(--rp)", padding: "var(--sp-1-5)", display: "flex", flexDirection: "column", gap: "calc(var(--p) * 1.2)", ...style }}
      {...rest}
    >
      <div style={{ fontSize: "0.8em", color: "var(--muted)" }}>
        <span style={{ color: errors ? "var(--err)" : "inherit", fontWeight: errors ? "var(--fw-medium)" : "inherit" }}>{errors} error{errors === 1 ? "" : "s"}</span>
        {" · "}
        <span style={{ color: warnings ? "var(--warn)" : "inherit", fontWeight: warnings ? "var(--fw-medium)" : "inherit" }}>{warnings} warning{warnings === 1 ? "" : "s"}</span>
        {" · "}
        <span>{info} info</span>
      </div>
      {children}
    </div>
  );
}
