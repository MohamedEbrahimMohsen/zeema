import * as React from "react";

/**
 * Two empty treatments: a dashed inline slot, and a solid panel for page-level nothing.
 * @startingPoint section="Feedback" subtitle="Dashed inline slot and page-level panel" viewport="700x180"
 */
export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  /** inline = dashed border, muted, no title · panel = solid card with title and action */
  variant?: "inline" | "panel";
  title?: React.ReactNode;
  action?: React.ReactNode;
  children?: React.ReactNode;
}

export declare function EmptyState(props: EmptyStateProps): JSX.Element;
