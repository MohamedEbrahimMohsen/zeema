import * as React from "react";

export interface ContextMenuItem {
  label?: string;
  /** Rendered mono, right-aligned. Use real glyphs: ⌃ ⇧ ⌫. */
  shortcut?: string;
  active?: boolean;
  disabled?: boolean;
  danger?: boolean;
  separator?: boolean;
}

/**
 * Right-click menu on the canvas — one of the few things in Arkore that casts a shadow.
 * @startingPoint section="Canvas" subtitle="Right-click menu with shortcuts" viewport="700x220"
 */
export interface ContextMenuProps extends React.HTMLAttributes<HTMLDivElement> {
  items?: ContextMenuItem[];
  width?: number;
}

export declare function ContextMenu(props: ContextMenuProps): JSX.Element;
