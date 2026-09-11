import * as React from "react";

/** Inline save/sync state. Colour carries the meaning; only `err` adds weight. */
export interface StatusTextProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: "idle" | "ok" | "warn" | "err";
  children?: React.ReactNode;
}

export declare function StatusText(props: StatusTextProps): JSX.Element;
