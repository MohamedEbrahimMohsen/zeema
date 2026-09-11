import * as React from "react";

/** The nine canvas categories. Each maps to a --t-<name>-fill / --t-<name>-line pair. */
export type Taxonomy = "blue" | "teal" | "amber" | "violet" | "purple" | "green" | "rose" | "red" | "grey";

/**
 * A component on the canvas. Fill encodes category; border encodes selection; a corner dot encodes findings.
 * @startingPoint section="Canvas" subtitle="Node with taxonomy fill, selection and finding badge" viewport="700x200"
 */
export interface CanvasNodeProps extends React.HTMLAttributes<HTMLDivElement> {
  /** The instance name the author gave it — "orders", "session". */
  label: string;
  /** The component kind, mono, beneath the label — "sqs", "worker". */
  kind?: string;
  /** compute=blue · edge=teal · data=amber · ops=violet · security=purple · messaging=green · client=rose · external=red · unset=grey */
  taxonomy?: Taxonomy;
  icon?: string;
  iconKind?: "component" | "kind";
  /** Swaps the category border for a 2px accent border. Selection never changes the fill. */
  selected?: boolean;
  /** Corner badge for the worst unresolved finding on this node. */
  status?: "ok" | "warn" | "err";
  /** Shows a connection port on the right edge. */
  port?: boolean;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

export declare function CanvasNode(props: CanvasNodeProps): JSX.Element;
