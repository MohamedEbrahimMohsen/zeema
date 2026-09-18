import * as React from "react";

/** Collapsible property group in the inspector. Meta reports how many values are set inside. */
export interface DisclosureProps extends React.HTMLAttributes<HTMLDetailsElement> {
  title: React.ReactNode;
  /** Right-aligned count, conventionally "· 1 set". */
  meta?: React.ReactNode;
  open?: boolean;
  children?: React.ReactNode;
}

export declare function Disclosure(props: DisclosureProps): JSX.Element;
