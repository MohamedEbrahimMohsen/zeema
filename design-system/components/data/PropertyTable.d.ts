import * as React from "react";

/** Cell value — a bare string, or a string plus a semantic tone token. */
export type PropertyCell = string | { label: string; tone?: "ok" | "warn" | "err" | "muted" | "ink" };

/**
 * The schema view: every cell mono, because every cell is machine-owned.
 * @startingPoint section="Data" subtitle="Schema table — property, type, default" viewport="700x160"
 */
export interface PropertyTableProps extends React.HTMLAttributes<HTMLDivElement> {
  columns?: string[];
  rows?: PropertyCell[][];
}

export declare function PropertyTable(props: PropertyTableProps): JSX.Element;
