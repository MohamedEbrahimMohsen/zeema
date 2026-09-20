"use client";

// The one-line summary under the title: plain text for readers, click-to-edit for the owner,
// the same way the title and the address above it behave. Enter or blur saves, Escape cancels.
// When there is nothing yet the owner sees an invitation and a reader sees nothing at all.
import { useRouter } from "next/navigation";
import { useState } from "react";

const MAX = 280;

type Props = { owner: string; slug: string; summary: string; canWrite: boolean };

export function EditableSummary({ owner, slug, summary, canWrite }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [shown, setShown] = useState(summary);
  const [error, setError] = useState<string | null>(null);

  const commit = async (next: string) => {
    const value = next.trim().slice(0, MAX);
    setEditing(false);
    if (value === shown) return;
    const prev = shown;
    setShown(value);
    setError(null);
    const res = await fetch(`/api/v1/designs/${owner}/${slug}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ summary: value }),
    });
    if (!res.ok) {
      setShown(prev);
      const body = await res.json().catch(() => ({}));
      setError(body?.error?.message ?? `save failed (${res.status})`);
      return;
    }
    router.refresh();
  };

  if (!canWrite) return shown ? <p className="muted">{shown}</p> : null;
  if (editing)
    return (
      <p className="m-0">
        <input
          className="input summary-input"
          defaultValue={shown}
          maxLength={MAX}
          aria-label="One-line summary"
          placeholder="Add a one-line summary"
          // biome-ignore lint/a11y/noAutofocus: the field appears on the user's own click
          autoFocus
          onFocus={(e) => e.currentTarget.select()}
          onBlur={(e) => void commit(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") setEditing(false);
          }}
        />
      </p>
    );
  return (
    <p className="m-0">
      <button
        type="button"
        className={`summary-btn${shown ? "" : " is-empty"}`}
        title="Edit the summary"
        onClick={() => setEditing(true)}
      >
        {shown || "Add a one-line summary"}
      </button>
      {error ? <span className="status status-err small"> {error}</span> : null}
    </p>
  );
}
