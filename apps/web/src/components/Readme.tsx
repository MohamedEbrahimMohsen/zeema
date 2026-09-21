"use client";

// The About section. Readers get the server-rendered Markdown passed in as `children`, so
// nothing about reading a design waits on JavaScript; the owner gets an Edit button that swaps
// in a textarea with a live preview beside it. It folds like the sections around it
// (CollapsibleSection, remembered under `zeema-section-about`), open by default when there is a
// README to read and closed when all it holds is the owner's "write one" placeholder. Edit works
// from a folded section: opening the editor opens the section with it.
//
// Ctrl+Enter saves, Escape cancels, and the counter warns before the limit rather than after,
// because losing the end of a long write-up to a silent truncation would be the worst outcome.
import { useRouter } from "next/navigation";
import { type ReactNode, useRef, useState } from "react";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import { Pencil } from "@/components/Glyphs";
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
  // Bumped when the editor opens, so a folded About unfolds to show the field.
  const [openSeq, setOpenSeq] = useState(0);
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
    setOpenSeq((n) => n + 1);
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

  const over = draft.length > MAX_README;
  const counter = editing ? (
    <span
      className={`small ${over ? "status-err" : draft.length > WARN_AT ? "status-warn" : "muted"}`}
    >
      {draft.length.toLocaleString("en-GB")} / {MAX_README.toLocaleString("en-GB")}
    </span>
  ) : null;
  const actions = editing ? (
    <>
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
    </>
  ) : canWrite ? (
    <button
      type="button"
      className="btn-icon btn-icon-text"
      onClick={open}
      aria-label="Edit the README"
      title="Edit"
    >
      <Pencil />
      <span>Edit</span>
    </button>
  ) : null;

  return (
    <CollapsibleSection
      name="about"
      title="About"
      defaultOpen={Boolean(readme)}
      openSeq={openSeq}
      aside={counter}
      actions={actions}
    >
      {editing ? (
        <div className="flex flex-col gap-2">
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
        </div>
      ) : readme ? (
        children
      ) : (
        <button type="button" className="readme-empty" onClick={open}>
          Write a README for this design — Markdown supported
        </button>
      )}
      {error ? <span className="status status-err small">{error}</span> : null}
    </CollapsibleSection>
  );
}
