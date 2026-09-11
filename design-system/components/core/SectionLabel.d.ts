import * as React from "react";

/** The Blueprint signature: mono, uppercase, 0.08em tracking. Names a region, never a value. */
export interface SectionLabelProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
}

export declare function SectionLabel(props: SectionLabelProps): JSX.Element;
