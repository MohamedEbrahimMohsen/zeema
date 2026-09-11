import * as React from "react";

/** A single rule violation: a human sentence, then the machine coordinates that produced it. */
export interface FindingProps extends React.HTMLAttributes<HTMLDivElement> {
  severity?: "err" | "warn" | "ok";
  /** Full sentence naming the offending node in quotes, ending in a full stop. */
  message: React.ReactNode;
  /** Rule id, hyphenated — "cache-missing-eviction-policy". */
  rule: string;
  /** Where it fired — "node session". */
  target?: string;
}

export declare function Finding(props: FindingProps): JSX.Element;
