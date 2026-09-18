import * as React from "react";

/** A dashed grouping frame — region, VPC, account, trust boundary. Never filled. */
export interface BoundaryProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Mono caption naming the boundary and its type — "us-east-1 (region)". */
  label?: string;
  inset?: number;
  children?: React.ReactNode;
}

export declare function Boundary(props: BoundaryProps): JSX.Element;
