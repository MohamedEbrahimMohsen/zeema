import * as React from "react";

/** A connection between two nodes. Dashed = asynchronous; solid = synchronous. */
export interface CanvasEdgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  x: number;
  y: number;
  length?: number;
  /** true (default) for async/queued flow; false for a synchronous call. */
  dashed?: boolean;
  arrow?: boolean;
  rotate?: number;
  color?: string;
}

export declare function CanvasEdge(props: CanvasEdgeProps): JSX.Element;
