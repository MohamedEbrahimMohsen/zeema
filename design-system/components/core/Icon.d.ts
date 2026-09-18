import * as React from "react";

/**
 * Renders the three Zeema icon classes with the right colour behaviour for each.
 * @startingPoint section="Core" subtitle="Brand marks, masked kind glyphs, provider logos" viewport="700x140"
 */
export interface IconProps {
  /** Path into assets/icons — components/<provider>/<name>.svg, kinds/<name>.svg or providers/<name>.svg */
  src: string;
  /** component = full-colour vendor mark · kind = masked monochrome glyph · provider = logo tinted in dark */
  kind?: "component" | "kind" | "provider";
  size?: string;
  /** Mask fill for kind glyphs only. Defaults to --ink. */
  color?: string;
  alt?: string;
  style?: React.CSSProperties;
}

export declare function Icon(props: IconProps): JSX.Element;
