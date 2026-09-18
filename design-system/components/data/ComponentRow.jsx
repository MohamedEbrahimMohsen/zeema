import React from "react";
import { Icon } from "../core/Icon.jsx";
import { Tag } from "../core/Tag.jsx";

export function ComponentRow({ name, slug, provider, kind, icon, iconKind = "component", last = false, style, ...rest }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "var(--icon) 1fr auto auto",
        gap: "var(--sp-1-5)",
        alignItems: "center",
        padding: "calc(var(--p) * 1.2) calc(var(--p) * 1.8)",
        borderBottom: last ? "none" : "var(--border) solid var(--line)",
        ...style,
      }}
      {...rest}
    >
      {icon ? <Icon src={icon} kind={iconKind} /> : <span style={{ width: "var(--icon)" }} />}
      <div style={{ display: "flex", gap: "var(--sp-1)", alignItems: "baseline", minWidth: 0 }}>
        <span style={{ fontWeight: "var(--fw-medium)" }}>{name}</span>
        <span style={{ fontFamily: "var(--mono)", fontSize: "0.8em", color: "var(--muted)" }}>{slug}</span>
      </div>
      {provider ? <Tag mono style={{ fontSize: "0.72em" }}>{provider}</Tag> : <span />}
      <span style={{ fontSize: "var(--fs-small)", color: "var(--muted)" }}>{kind}</span>
    </div>
  );
}
