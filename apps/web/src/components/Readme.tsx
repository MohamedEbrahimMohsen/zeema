"use client";

// The About section. Readers get the server-rendered Markdown passed in as `children`, so
// nothing about reading a design waits on JavaScript; the owner gets an Edit button that swaps
// in a textarea with a live preview beside it.
//
// Ctrl+Enter saves, Escape cancels, and the counter warns before the limit rather than after,
// because losing the end of a long write-up to a silent truncation would be the worst outcome.
import { useRouter } from "next/navigation";
import { type ReactNode, useRef, useState } from "react";
import { Markdown } from "@/components/Markdown";

export const MAX_README = 20_000;
const WARN_AT = 18_000;

type Props = {
  owner: string;
  slug: string;
  readme: string;
  canWrite: boolean;
  /** The same README, rendered on the server, for everything but edit mode. */
  children: ReactNode;
};

export function Readme({ owner, slug, readme, canWrite, children }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(readme);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const box = useRef<HTMLTextAreaElement>(null);

  // The field grows with what is written in it: a README is read as a whole, not through a
  // six-line window. Called on every keystroke and once when the editor opens.
  const grow = () => {
    const el = box.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(el.scrollHeight, 240)}px`;
  };

  const open = () => {
    setDraft(readme);
    setError(null);
    setEditing(true);
  };

  const save = async () => {
    if (draft.length > MAX_README || busy) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/v1/designs/${owner}/${slug}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ readme: draft }),
    });
    setBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body?.error?.message ?? `save failed (${res.status})`);
      return;
    }
    setEditing(false);
    router.refresh();
  };

  if (!canWrite && !readme) return null;

  if (!editing)
    return (
      <section className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <span className="label">About</span>
          {canWrite && readme ? (
            <button type="button" className="btn btn-sm ml-auto" onClick={open}>
              Edit
            </button>
          ) : null}
        </div>
        {readme ? (
          <div className="panel p-4">{children}</div>
        ) : (
          <button type="button" className="readme-empty" onClick={open}>
            Write a README for this design — Markdown supported
          </button>
        )}
        {error ? <span className="status status-err small">{error}</span> : null}
      </section>
    );

  const over = draft.length > MAX_README;
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <span className="label">About</span>
        <span
          className={`small ml-auto ${over ? "status-err" : draft.length > WARN_AT ? "status-warn" : "muted"}`}
        >
          {draft.length.toLocaleString("en-GB")} / {MAX_README.toLocaleString("en-GB")}
        </span>
        <button
          type="button"
          className="btn btn-sm btn-primary"
          disabled={busy || over}
          onClick={() => void save()}
        >
          {busy ? "Saving…" : "Save"}
        </button>
        <button type="button" className="btn btn-sm" onClick={() => setEditing(false)}>
          Cancel
        </button>
      </div>
      <div className="readme-edit">
        <textarea
          ref={(el) => {
            box.current = el;
            grow();
          }}
          className="input mono readme-box"
          rows={12}
          maxLength={MAX_README}
          spellCheck
          aria-label="README, in Markdown"
          value={draft}
          placeholder={"# Overview\n\nWhat this design is, and why it is shaped this way."}
          // biome-ignore lint/a11y/noAutofocus: the field appears on the user's own click
          autoFocus
          onChange={(e) => {
            setDraft(e.target.value);
            grow();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              void save();
            }
            if (e.key === "Escape") setEditing(false);
          }}
        />
        <div className="panel p-4 readme-preview">
          {draft.trim() ? (
            <Markdown>{draft}</Markdown>
          ) : (
            <span className="muted small">The preview appears as you write.</span>
          )}
        </div>
      </div>
      <span className="meta">Markdown, with tables and task lists. Ctrl+Enter saves.</span>
      {error ? <span className="status status-err small">{error}</span> : null}
    </section>
  );
}
