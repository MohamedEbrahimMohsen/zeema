import React from "react";

const tones = {
  idle: { color: "var(--muted)" },
  ok: { color: "var(--ok)" },
  warn: { color: "var(--warn)" },
  err: { color: "var(--err)", fontWeight: "var(--fw-medium)" },
};

export function StatusText({ tone = "idle", children, style, ...rest }) {
  return <span style={{ fontSize: "var(--fs-small)", ...tones[tone], ...style }} {...rest}>{children}</span>;
}
