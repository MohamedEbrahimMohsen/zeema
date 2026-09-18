import React from "react";

export function Tag({ tone = "neutral", mono = false, children, style, ...rest }) {
  const toned = tone === "danger"
    ? { borderColor: "var(--err)", color: "var(--err)" }
    : { borderColor: "var(--line)", color: "var(--muted)" };
  return (
    <span
      style={{
        padding: "1px 9px",
        borderRadius: "var(--r-round)",
        border: "var(--border) solid",
        fontSize: "var(--fs-meta)",
        fontFamily: mono ? "var(--mono)" : "var(--sans)",
        whiteSpace: "nowrap",
        ...toned,
        ...style,
      }}
      {...rest}
    >
      {children}
    </span>
  );
}
