import * as React from "react";

/**
 * Gallery tile for a published design: thumbnail, title, one-line summary, provenance strip.
 * @startingPoint section="Data" subtitle="Gallery tile for a published design" viewport="700x320"
 */
export interface DesignCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  /** One sentence, sentence case, ending in a full stop. */
  description?: string;
  /** Owner handle — an org slug ("arkore") or a person ("@mira"). */
  author?: string;
  componentCount?: number;
  provider?: string;
  clones?: number;
  visibility?: string;
  /** 16:10 preview region. Pass a mini-diagram, a brand mark, or a title plate. */
  thumbnail?: React.ReactNode;
}

export declare function DesignCard(props: DesignCardProps): JSX.Element;
