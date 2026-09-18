import * as React from "react";

/**
 * Inspector row: label above control above a mono type/provenance hint.
 * @startingPoint section="Forms" subtitle="Inspector field with type hint" viewport="700x180"
 */
export interface FieldProps extends React.HTMLAttributes<HTMLDivElement> {
  label?: string;
  /** Mono caption carrying the property's type and where its value came from. */
  hint?: string;
  /** true when the value is inherited from the kind rather than set on this node — dims the label. */
  inherited?: boolean;
  children?: React.ReactNode;
}

export declare function Field(props: FieldProps): JSX.Element;
