"use client";

// The preview of a referenced design: a click on a node's reference disc opens it. A native
// <dialog> opened with showModal(), as the app's confirmation dialog (components/ConfirmDialog):
// Escape and a click on the backdrop close it. The body is the server render of the release
// chosen in the header, at its own size, scrolling when it is larger than the window.
import { useEffect, useId, useRef, useState } from "react";
import {
  pinnedRelease,
  type RefStore,
  type RefVersion,
  refHref,
  refState,
  renderHref,
} from "./ref-state";

export type RefTarget = { owner: string; slug: string; version: RefVersion };

export function RefPreview({
  target,
  store,
  theme,
  onClose,
}: {
  target: RefTarget;
  store: RefStore;
  theme: string;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [version, setVersion] = useState<RefVersion>(target.version);
  const [, setTick] = useState(0);
  useEffect(() => {
    const off = store.subscribe(() => setTick((t) => t + 1));
    store.ensure(target.owner, target.slug).then(() => setTick((t) => t + 1));
    return off;
  }, [store, target.owner, target.slug]);
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, []);

  const entry = store.get(target.owner, target.slug);
  const state = refState(entry, version);
  const summary = entry?.status === "ok" ? entry.summary : null;
  const release = pinnedRelease(entry, version);
  const href = refHref(target.owner, target.slug, entry, version);
  // "head" draws the current release (what a reader of the design sees); a release by its id.
  const src =
    summary && (release || version === "head")
      ? renderHref(
          summary.owner,
          summary.slug,
          version === "head" || !release ? null : release.id,
          theme,
        )
      : null;
  return (
    <dialog
      ref={ref}
      className="confirm-dialog ref-preview"
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      // The canvas's own shortcuts stand down while the preview has the keyboard.
      onKeyDown={(e) => e.stopPropagation()}
    >
      <div className="ref-preview-panel">
        <header className="ref-preview-head">
          <p id={titleId} className="confirm-title">
            {summary ? summary.name : state === "unreachable" ? "Design not available" : "…"}
          </p>
          <span className="tag tag-mono">{summary?.owner ?? target.owner}</span>
          {summary ? (
            <select
              aria-label="Release"
              value={String(version)}
              onChange={(e) =>
                setVersion(e.target.value === "head" ? "head" : Number(e.target.value))
              }
            >
              <option value="head">latest</option>
              {[...summary.releases].reverse().map((r) => (
                <option key={r.id} value={r.version}>
                  v{r.version}
                  {r.version === target.version ? " · pinned" : ""}
                </option>
              ))}
              {typeof version === "number" && !release ? (
                <option value={version}>v{version} · not released</option>
              ) : null}
            </select>
          ) : null}
          <span className="ref-preview-gap" />
          {state !== "unreachable" ? (
            <a className="btn btn-sm" href={href} target="_blank" rel="noopener noreferrer">
              Open in new tab ↗
            </a>
          ) : null}
          <button type="button" className="btn btn-sm" onClick={onClose}>
            Close
          </button>
        </header>
        <div className="ref-preview-body">
          {src ? (
            <img src={src} alt={summary ? `${summary.name}, drawn` : ""} />
          ) : (
            <p className="confirm-body">
              {state === "unreachable"
                ? "This design is private, deleted, or the platform did not answer."
                : state === "pending"
                  ? "Loading…"
                  : "This release is not published."}
            </p>
          )}
        </div>
      </div>
    </dialog>
  );
}
