import React from "react";

export function Select({ options = [], style, ...rest }) {
  return (
    <select style={{ ...{
        font: "inherit",
        fontSize: "0.9em",
        fontFamily: "var(--sans)",
        padding: "calc(var(--p) * 0.8) calc(var(--p) * 1.2)",
        borderRadius: "var(--rc)",
        border: "var(--border) solid var(--line)",
        background: "var(--panel)",
        color: "var(--ink)",
        width: "100%",
        boxSizing: "border-box",
      }, ...style }} {...rest}>
      {options.map((o) => (typeof o === "string" ? <option key={o} value={o}>{o}</option> : <option key={o.value} value={o.value}>{o.label}</option>))}
    </select>
  );
}
