import * as React from "react";

/**
 * Container for validation output — a severity tally, then the findings themselves.
 * @startingPoint section="Feedback" subtitle="Validation results with severity tally" viewport="700x260"
 */
export interface FindingsPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  errors?: number;
  warnings?: number;
  info?: number;
  children?: React.ReactNode;
}

export declare function FindingsPanel(props: FindingsPanelProps): JSX.Element;
