import React from "react";

export function Field({ label, hint, inherited = false, children, style, ...rest }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-0-5)", ...style }} {...rest}>
      {label && (
        <label style={{ fontSize: "0.8em", fontWeight: inherited ? "var(--fw-regular)" : "var(--fw-semibold)", color: inherited ? "var(--muted)" : "var(--ink)" }}>
          {label}
        </label>
      )}
      {children}
      {hint && <span style={{ fontFamily: "var(--mono)", fontSize: "var(--fs-micro)", color: "var(--muted)" }}>{hint}</span>}
    </div>
  );
}
