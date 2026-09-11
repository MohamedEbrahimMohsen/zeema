import React from "react";

const base = {
  font: "inherit",
  fontFamily: "var(--sans)",
  lineHeight: 1.2,
  borderRadius: "var(--rc)",
  borderWidth: "var(--border)",
  borderStyle: "solid",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: "var(--sp-1)",
  transition: "background var(--dur-fast) var(--ease), border-color var(--dur-fast) var(--ease), color var(--dur-fast) var(--ease)",
};

const sizes = {
  sm: { fontSize: "var(--fs-small)", padding: "calc(var(--p) * 0.6) calc(var(--p) * 1.4)" },
  md: { fontSize: "0.9em", padding: "calc(var(--p) * 0.9) calc(var(--p) * 1.8)" },
};

const variants = {
  primary: { background: "var(--accent)", borderColor: "var(--accent)", color: "var(--accent-ink)", fontWeight: "var(--fw-medium)" },
  secondary: { background: "var(--panel)", borderColor: "var(--line)", color: "var(--ink)" },
  danger: { background: "var(--panel)", borderColor: "var(--line)", color: "var(--err)" },
  ghost: { background: "transparent", borderColor: "transparent", color: "var(--muted)" },
};

export function Button({ variant = "secondary", size = "md", disabled = false, icon, children, style, ...rest }) {
  return (
    <button
      type="button"
      disabled={disabled}
      style={{ ...base, ...sizes[size], ...variants[variant], ...(disabled ? { opacity: 0.45, cursor: "not-allowed" } : null), ...style }}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}
