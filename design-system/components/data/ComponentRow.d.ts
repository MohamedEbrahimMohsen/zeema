import * as React from "react";

/**
 * One entry in the component catalog: icon, display name, slug, provider, kind.
 * @startingPoint section="Data" subtitle="Catalog row — icon, name, slug, provider, kind" viewport="700x200"
 */
export interface ComponentRowProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Human display name — "Simple Queue Service", "Pub/Sub". */
  name: string;
  /** Machine identifier — "aws-sqs", "cron-job". Rendered mono. */
  slug: string;
  /** Provider slug; omitted for provider-agnostic components like Kafka. */
  provider?: string;
  /** Category the component belongs to — "queue", "stream", "worker". */
  kind: string;
  icon?: string;
  iconKind?: "component" | "kind";
  /** Suppresses the bottom rule on the final row of a list. */
  last?: boolean;
}

export declare function ComponentRow(props: ComponentRowProps): JSX.Element;
