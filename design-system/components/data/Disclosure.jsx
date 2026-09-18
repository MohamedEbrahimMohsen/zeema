import React from "react";

export function Disclosure({ title, meta, open = false, children, style, ...rest }) {
  return (
    <details
      open={open}
      style={{ background: "var(--panel)", border: "var(--border) solid var(--line)", borderRadius: "var(--rp)", padding: "var(--sp-1) var(--sp-1-5)", fontSize: "var(--fs-small)", ...style }}
      {...rest}
    >
      <summary style={{ cursor: "pointer", display: "flex", justifyContent: "space-between", listStyle: "none" }}>
        <span style={{ fontWeight: "var(--fw-medium)" }}>{title}</span>
        {meta && <span style={{ color: "var(--muted)" }}>{meta}</span>}
      </summary>
      <div style={{ marginTop: "calc(var(--p) * 0.75)" }}>{children}</div>
    </details>
  );
}
