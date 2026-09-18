import * as React from "react";

/** Boolean property. Label is the property identifier verbatim (camelCase), not a sentence. */
export interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: React.ReactNode;
}

export declare function Checkbox(props: CheckboxProps): JSX.Element;
