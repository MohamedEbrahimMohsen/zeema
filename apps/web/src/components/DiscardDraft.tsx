"use client";

// Going back to the release. The owner's draft is thrown away as the design's head, but not as
// history: every version stays in the list, so the discarded work is one click away for as long
// as the design exists. The confirmation says so, because "discard" reads like "delete".
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Undo } from "@/components/Glyphs";

type Props = {
  owner: string;
  slug: string;
  /** When the release the draft would go back to was published, already formatted. */
  releasedAt: string;
};

export function DiscardDraft({ owner, slug, releasedAt }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const discard = async () => {
    if (busy) return;
    if (
      !confirm(
        `Discard the draft and go back to the released version from ${releasedAt}? ` +
          "The draft's versions stay in History, but the canvas and readers of your draft will " +
          "see the release.",
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
