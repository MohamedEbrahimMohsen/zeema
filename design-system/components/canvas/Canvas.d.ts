import * as React from "react";

/**
 * The dotted drafting surface. Children are absolutely positioned onto it.
 * @startingPoint section="Canvas" subtitle="Dotted drafting ground" viewport="700x220"
 */
export interface CanvasProps extends React.HTMLAttributes<HTMLDivElement> {
  height?: number | string;
  children?: React.ReactNode;
}

export declare function Canvas(props: CanvasProps): JSX.Element;
