"use client";

// The address in the breadcrumb: plain text for readers, click-to-rename for the owner. Renaming
// moves the page, so a success navigates to the new address rather than leaving the browser on
// one that only works because of the redirect.
//
// Once a design has been published its old address is reserved for good, which the field says
// before the rename rather than after, because that is when it can still be reconsidered.

import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  owner: string;
  slug: string;
  canWrite: boolean;
  /** Published designs leave their old address behind, reserved. */
  published: boolean;
};

const clean = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

export function EditableSlug({ owner, slug, canWrite, published }: Props) {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const [editing, setEditing] = useState(false);
  const [shown, setShown] = useState(slug);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const commit = async (next: string) => {
    const value = clean(next);
    setEditing(false);
    if (!value || value === shown) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/v1/designs/${owner}/${shown}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug: value }),
    });
    setBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body?.error?.message ?? `rename failed (${res.status})`);
      return;
    }
    const { design } = await res.json();
    setShown(design.slug);
    // Same page, new address: /d/owner/<old>/canvas becomes /d/owner/<new>/canvas.
    router.replace(pathname.replace(`/d/${owner}/${shown}`, `/d/${owner}/${design.slug}`));
    router.refresh();
  };

  if (!canWrite) return <span>{shown}</span>;
  if (editing)
    return (
      <span className="slug-edit">
        <input
          className="input slug-input mono"
          defaultValue={shown}
          maxLength={60}
          aria-label="Design address"
          // biome-ignore lint/a11y/noAutofocus: the field appears on the user's own click
          autoFocus
          onFocus={(e) => e.currentTarget.select()}
          onBlur={(e) => void commit(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") setEditing(false);
          }}
        />
        <span className="small muted">
          {published
            ? "The old address keeps working and stays reserved."
            : "Not published yet, so nothing links here."}
        </span>
      </span>
    );
  return (
    <>
      <button
        type="button"
        className="slug-btn"
        title="Change the address"
        disabled={busy}
        onClick={() => setEditing(true)}
      >
        {shown}
      </button>
      {error ? <span className="status status-err small">{error}</span> : null}
    </>
  );
}
