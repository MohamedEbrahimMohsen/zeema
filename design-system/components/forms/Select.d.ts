import * as React from "react";

/** Enum control — the most common inspector input, since most Zeema properties are enums. */
export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options?: Array<string | { value: string; label: string }>;
}

export declare function Select(props: SelectProps): JSX.Element;
