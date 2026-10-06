"use client";

// Going back to the release. The draft is thrown away for good: the head moves back and the
// versions saved since the release are deleted. The confirmation says how many, and that it
// cannot be undone, because by the time someone reads it the work is one click from gone.
//
// A design whose head already is the release can still carry versions after it — one discarded
// before discarding deleted anything. There the head does not move and the button only clears
// those rows, so it says so rather than offering to go back somewhere it already is.
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useConfirm } from "@/components/ConfirmDialog";
import { Undo } from "@/components/Glyphs";

type Props = {
  owner: string;
  slug: string;
  /** When the release the draft would go back to was published, already formatted. */
  releasedAt: string;
  /** How many versions the discard deletes; counted server-side by the design service. */
  draftVersionCount: number;
  /**
   * Whether the head still has to move back. False for a design whose head already is the
   * release but which kept abandoned versions behind it, where this button only deletes them.
   */
  headMoved: boolean;
};

export function DiscardDraft({ owner, slug, releasedAt, draftVersionCount, headMoved }: Props) {
  const router = useRouter();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const discard = async () => {
    if (busy) return;
    const versions = `${draftVersionCount} draft version${draftVersionCount === 1 ? "" : "s"}`;
    const question = headMoved
      ? `Discard the draft and go back to the released version from ${releasedAt}? ` +
        `The ${versions} since then will be deleted. This cannot be undone.`
      : `Delete the ${versions} after the released version from ${releasedAt}? ` +
        "This cannot be undone.";
    if (!(await confirm({ title: question, confirmLabel: "Discard", danger: true }))) return;
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
        aria-label={
          headMoved
            ? "Discard the draft changes and go back to the released version"
            : "Delete the draft versions kept after the released version"
        }
        title={headMoved ? "Discard draft changes" : "Delete the leftover draft versions"}
      >
        <Undo />
        <span>{busy ? "Discarding…" : headMoved ? "Discard draft" : "Delete draft versions"}</span>
      </button>
      {error ? <span className="status status-err small">{error}</span> : null}
    </>
  );
}
