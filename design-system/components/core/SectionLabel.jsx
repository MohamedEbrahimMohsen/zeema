import React from "react";

export function SectionLabel({ children, style, ...rest }) {
  return (
    <div
      style={{
        fontFamily: "var(--lab-font)",
        textTransform: "var(--lab-tt)",
        letterSpacing: "var(--lab-ls)",
        fontSize: "var(--fs-meta)",
        color: "var(--muted)",
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}
