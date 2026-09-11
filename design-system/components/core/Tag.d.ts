import * as React from "react";

/**
 * Round-cornered metadata pill: providers, visibility, and broken-reference warnings.
 * @startingPoint section="Core" subtitle="Provider and visibility pills" viewport="700x120"
 */
export interface TagProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: "neutral" | "danger";
  /** true for machine-owned strings (provider slugs: aws, azure, gcp). */
  mono?: boolean;
  children?: React.ReactNode;
}

export declare function Tag(props: TagProps): JSX.Element;
