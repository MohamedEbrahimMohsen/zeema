import React from "react";

export function Finding({ severity = "err", message, rule, target, style, ...rest }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "10px 1fr", gap: "var(--sp-1)", alignItems: "start", ...style }} {...rest}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: `var(--${severity})`, marginTop: 6 }} />
      <div style={{ fontSize: "0.9em" }}>
        <div>{message}</div>
        <div style={{ fontFamily: "var(--mono)", fontSize: "var(--fs-meta)", color: `var(--${severity})` }}>
          {rule}{target ? ` · ${target}` : ""}
        </div>
      </div>
    </div>
  );
}
