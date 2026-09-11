import React from "react";

export function ContextMenu({ items = [], width = 190, style, ...rest }) {
  return (
    <div
      style={{ width, background: "var(--panel)", border: "var(--border) solid var(--line)", borderRadius: "var(--rc)", padding: 4, boxShadow: "var(--shadow-float)", fontSize: "var(--fs-small)", ...style }}
      {...rest}
    >
      {items.map((it, i) =>
        it.separator ? (
          <div key={i} style={{ height: 1, background: "var(--line)", margin: "4px 0" }} />
        ) : (
          <div
            key={i}
            style={{
              display: "flex", justifyContent: "space-between",
              padding: "5px 10px", borderRadius: "calc(var(--rc) - 2px)",
              background: it.active ? "var(--accent)" : "transparent",
              color: it.active ? "var(--accent-ink)" : it.danger ? "var(--err)" : "var(--ink)",
              opacity: it.disabled ? 0.5 : 1,
              cursor: it.disabled ? "default" : "pointer",
            }}
          >
            <span>{it.label}</span>
            {it.shortcut && (
              <span style={{ fontFamily: "var(--mono)", color: it.active || it.danger ? "inherit" : "var(--muted)", opacity: it.active || it.danger ? 0.8 : 1 }}>
                {it.shortcut}
              </span>
            )}
          </div>
        )
      )}
    </div>
  );
}
