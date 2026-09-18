import React from "react";
import { Icon } from "../core/Icon.jsx";

export function CanvasNode({
  label, kind, taxonomy = "grey", icon, iconKind = "component",
  selected = false, status, port = false,
  x, y, width = 104, height = 74, style, ...rest
}) {
  return (
    <div
      style={{
        position: x != null ? "absolute" : "relative",
        left: x, top: y, width, height,
        borderRadius: "var(--rn)",
        background: `var(--t-${taxonomy}-fill)`,
        border: selected ? `var(--border-selected) solid var(--accent)` : `var(--border) solid var(--t-${taxonomy}-line)`,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2,
        transition: "border-color var(--dur) var(--ease)",
        ...style,
      }}
      {...rest}
    >
      {icon && <Icon src={icon} kind={iconKind} />}
      <span style={{ fontSize: "var(--fs-small)", fontWeight: "var(--fw-medium)" }}>{label}</span>
      {kind && <span style={{ fontSize: "var(--fs-micro)", fontFamily: "var(--mono)", color: "var(--muted)" }}>{kind}</span>}
      {status && (
        <span style={{ position: "absolute", right: -6, top: -6, width: 12, height: 12, borderRadius: "50%", background: `var(--${status})`, border: "2px solid var(--panel)" }} />
      )}
      {port && (
        <span style={{ position: "absolute", right: -6, bottom: 30, width: 10, height: 10, borderRadius: "50%", background: "var(--panel)", border: "1.5px solid var(--accent)" }} />
      )}
    </div>
  );
}
