import React from "react";

export function Radio({ label, style, ...rest }) {
  return (
    <label style={{ display: "flex", gap: "calc(var(--p) * 0.75)", alignItems: "center", fontSize: "0.9em", cursor: "pointer", ...style }}>
      <input type="radio" style={{ accentColor: "var(--accent)", margin: 0 }} {...rest} />
      {label}
    </label>
  );
}
