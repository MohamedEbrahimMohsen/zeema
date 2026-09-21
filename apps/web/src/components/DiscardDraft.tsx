"use client";

// Going back to the release. The draft is thrown away for good: the head moves back and the
// versions saved since the release are deleted. The confirmation says how many, and that it
// cannot be undone, because by the time someone reads it the work is one click from gone.
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Undo } from "@/components/Glyphs";

type Props = {
  owner: string;
  slug: string;
  /** When the release the draft would go back to was published, already formatted. */
  releasedAt: string;
  /** How many versions the discard deletes; counted server-side by the design service. */
  draftVersionCount: number;
};

export function DiscardDraft({ owner, slug, releasedAt, draftVersionCount }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const discard = async () => {
    if (busy) return;
    if (
      !confirm(
        `Discard the draft and go back to the released version from ${releasedAt}? ` +
          `The ${draftVersionCount} draft version${draftVersionCount === 1 ? "" : "s"} since ` +
          "then will be deleted. This cannot be undone.",
      )
    )
      return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/designs/${owner}/${slug}/discard-draft`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message ?? `${res.status}`);
      }
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className="btn-icon btn-icon-text is-danger"
        onClick={() => void discard()}
        disabled={busy}
        aria-label="Discard the draft changes and go back to the released version"
        title="Discard draft changes"
      >
        <Undo />
        <span>{busy ? "Discarding…" : "Discard draft"}</span>
      </button>
      {error ? <span className="status status-err small">{error}</span> : null}
    </>
  );
}
