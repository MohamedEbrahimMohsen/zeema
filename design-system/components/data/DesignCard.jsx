import React from "react";
import { Tag } from "../core/Tag.jsx";

export function DesignCard({ title, description, author, componentCount, provider, clones, visibility, thumbnail, style, ...rest }) {
  return (
    <div
      style={{ background: "var(--panel)", border: "var(--border) solid var(--line)", borderRadius: "var(--rp)", overflow: "hidden", display: "flex", flexDirection: "column", ...style }}
      {...rest}
    >
      <div style={{ aspectRatio: "16 / 10", borderBottom: "var(--border) solid var(--line)", position: "relative", overflow: "hidden", background: "var(--bg)" }}>
        {thumbnail}
      </div>
      <div style={{ padding: "var(--sp-1-5) calc(var(--p) * 1.8)", display: "flex", flexDirection: "column", gap: "calc(var(--p) * 0.75)" }}>
        <div style={{ fontWeight: "var(--fw-medium)" }}>{title}</div>
        {description && <div style={{ fontSize: "var(--fs-small)", color: "var(--muted)" }}>{description}</div>}
        <div style={{ display: "flex", gap: "var(--sp-1)", alignItems: "center", fontSize: "var(--fs-meta)", color: "var(--muted)", flexWrap: "wrap" }}>
          <span>{author}</span>
          {componentCount != null && <><span>·</span><span>{componentCount} components</span></>}
          {provider && <Tag mono style={{ padding: "0 7px" }}>{provider}</Tag>}
          {visibility && <Tag style={{ padding: "0 7px" }}>{visibility}</Tag>}
          {clones != null && <span style={{ marginLeft: "auto" }}>{clones} clones</span>}
        </div>
      </div>
    </div>
  );
}
