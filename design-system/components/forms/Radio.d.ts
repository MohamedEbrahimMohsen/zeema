import * as React from "react";

/** Exclusive choice among 2–3 short options — visibility, scope. Longer sets use Select. */
export interface RadioProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: React.ReactNode;
}

export declare function Radio(props: RadioProps): JSX.Element;
