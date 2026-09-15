"use client";

// The design page heading: plain text for readers, click-to-rename for the owner. Enter or
// blur saves through the design PATCH endpoint; Escape cancels.
import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = { owner: string; slug: string; title: string; canWrite: boolean };

export function EditableTitle({ owner, slug, title, canWrite }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [shown, setShown] = useState(title);
  const [error, setError] = useState<string | null>(null);

  const commit = async (next: string) => {
    const value = next.trim().slice(0, 120);
    setEditing(false);
    if (!value || value === shown) return;
    const prev = shown;
    setShown(value);
    setError(null);
    const res = await fetch(`/api/v1/designs/${owner}/${slug}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: value }),
    });
    if (!res.ok) {
      setShown(prev);
      const body = await res.json().catch(() => ({}));
      setError(body?.error?.message ?? `rename failed (${res.status})`);
      return;
    }
    router.refresh();
  };

  if (!canWrite) return <>{shown}</>;
  if (editing)
    return (
      <input
        className="input title-input"
        defaultValue={shown}
        maxLength={120}
        aria-label="Design title"
        // biome-ignore lint/a11y/noAutofocus: the field appears on the user's own click
        autoFocus
        onFocus={(e) => e.currentTarget.select()}
        onBlur={(e) => void commit(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") setEditing(false);
        }}
      />
    );
  return (
    <>
      <button type="button" className="title-btn" title="Rename" onClick={() => setEditing(true)}>
        {shown}
      </button>
      {error ? <span className="status status-err small">{error}</span> : null}
    </>
  );
}
