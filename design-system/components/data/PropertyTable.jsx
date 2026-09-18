import React from "react";

export function PropertyTable({ columns = ["property", "type", "default"], rows = [], style, ...rest }) {
  const grid = { display: "grid", gridTemplateColumns: `repeat(${columns.length}, 1fr)`, padding: "calc(var(--p) * 0.75) calc(var(--p) * 1.25)" };
  return (
    <div style={{ background: "var(--panel)", border: "var(--border) solid var(--line)", borderRadius: "var(--rp)", overflow: "hidden", fontSize: "0.8em", ...style }} {...rest}>
      <div style={{ ...grid, color: "var(--muted)", borderBottom: "var(--border) solid var(--line)", fontFamily: "var(--lab-font)", textTransform: "var(--lab-tt)", letterSpacing: "var(--lab-ls)", fontSize: "0.9em" }}>
        {columns.map((c) => <span key={c}>{c}</span>)}
      </div>
      {rows.map((r, i) => (
        <div key={i} style={{ ...grid, borderBottom: i === rows.length - 1 ? "none" : "var(--border) solid var(--line)", fontFamily: "var(--mono)" }}>
          {r.map((cell, j) => (
            <span key={j} style={{ color: cell && cell.tone ? `var(--${cell.tone})` : j === 0 ? "var(--ink)" : "var(--muted)" }}>
              {cell && cell.label !== undefined ? cell.label : cell}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}
