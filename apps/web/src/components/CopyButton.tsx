"use client";

// The copy control on a YAML block: an icon in the corner, a tick for a moment afterwards. The
// text is passed in rather than read back out of the page, so what lands on the clipboard is the
// source and never the line numbers drawn beside it.
//
// Where the Clipboard API is missing — an insecure origin, an old browser, a denied permission —
// it selects the block instead, so the keyboard shortcut still does the obvious thing. The gutter
// carries `user-select: none`, so a selection made that way skips the numbers too.
import { useState } from "react";

const Clipboard = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
    <rect x="8" y="3" width="8" height="4" rx="1" />
    <path d="M8 5H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
  </svg>
);

const Check = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
    <path d="m5 13 4 4L19 7" />
  </svg>
);

function selectInstead(button: HTMLElement) {
  const pre = button.closest(".yaml-section, .yaml-block, .code-block")?.querySelector("pre");
  if (!pre) return;
  const range = document.createRange();
  range.selectNodeContents(pre);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}

export function CopyButton({
  text,
  label = "Copy YAML",
  className = "copy-btn",
}: {
  text: string;
  label?: string;
  /** `copy-btn` for the overlay on a bare block; `btn-icon` inside a section toolbar. */
  className?: string;
}) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className={`${className}${done ? " is-done" : ""}`}
      aria-label={label}
      title="Copy"
      onClick={async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const button = e.currentTarget;
        try {
          if (!navigator.clipboard) throw new Error("no clipboard");
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          selectInstead(button);
        }
      }}
    >
      {done ? <Check /> : <Clipboard />}
    </button>
  );
}
