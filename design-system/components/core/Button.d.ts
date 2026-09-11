import * as React from "react";

/**
 * Arkore's action control. Exactly one primary per view; everything else is secondary.
 * @startingPoint section="Core" subtitle="Primary, secondary, danger and ghost actions" viewport="700x150"
 */
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** primary = the single committing action; danger tints the label only, never the fill. */
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md";
  disabled?: boolean;
  /** Leading glyph — pass an <Icon/>, not an emoji. */
  icon?: React.ReactNode;
  children?: React.ReactNode;
}

export declare function Button(props: ButtonProps): JSX.Element;
