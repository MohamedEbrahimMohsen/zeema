// The question asked before Publish, shared by the design page and the canvas so both say the
// same thing, and the one order both follow: ask, and send the request only on a yes.
import type { ConfirmOptions } from "./confirm";

export type PublishContext = {
  owner: string;
  slug: string;
  /** Where publishing puts the design (publishSlugFor); differs from `slug` for an unnamed draft. */
  plannedSlug: string;
  visibility: "public" | "private";
  /** The number the release will take (designs.ts `releaseNumbers`), when known. */
  nextRelease?: number;
};

export function publishQuestion({
  owner,
  slug,
  plannedSlug,
  visibility,
  nextRelease,
}: PublishContext): ConfirmOptions {
  const who =
    visibility === "public"
      ? "The current draft becomes the release everyone reads, and your followers are told."
      : "The current draft becomes the release. The design is private, so nobody else sees it until you make it public.";
  const move = plannedSlug !== slug ? ` It also moves to /d/${owner}/${plannedSlug}.` : "";
  const becomes = nextRelease ? ` This becomes v${nextRelease}.` : "";
  return {
    title: "Publish a new version?",
    body: `${who}${becomes}${move} A release stays in the version history for good: it cannot be unpublished.`,
    confirmLabel: "Publish",
    cancelLabel: "Cancel",
  };
}

/** Ask first; `send` runs only when the answer is yes. Resolves null when the user cancels. */
export async function confirmThenPublish<T>(
  ask: (opts: ConfirmOptions) => Promise<boolean>,
  ctx: PublishContext,
  send: () => Promise<T>,
): Promise<T | null> {
  if (!(await ask(publishQuestion(ctx)))) return null;
  return send();
}
