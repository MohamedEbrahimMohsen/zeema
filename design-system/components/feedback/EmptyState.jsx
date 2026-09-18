import React from "react";

export function EmptyState({ variant = "inline", title, children, action, style, ...rest }) {
  if (variant === "inline") {
    return (
      <div
        style={{ border: "var(--border) dashed var(--line)", borderRadius: "var(--rp)", padding: "var(--sp-3)", textAlign: "center", color: "var(--muted)", fontSize: "0.9em", ...style }}
        {...rest}
      >
        {children}
      </div>
    );
  }
  return (
    <div
      style={{ background: "var(--panel)", border: "var(--border) solid var(--line)", borderRadius: "var(--rp)", padding: "var(--sp-3)", display: "flex", flexDirection: "column", gap: "var(--sp-1)", alignItems: "flex-start", ...style }}
      {...rest}
    >
      {title && <div style={{ fontWeight: "var(--fw-semibold)", fontSize: "var(--fs-lead)" }}>{title}</div>}
      <div style={{ fontSize: "0.9em", color: "var(--muted)" }}>{children}</div>
      {action}
    </div>
  );
}
