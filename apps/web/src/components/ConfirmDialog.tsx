"use client";

// The app's one confirmation dialog, in place of the browser's `confirm()`. Mounted once in the
// root layout, so site pages and the canvas share it; callers ask through `useConfirm()`:
//
//   const confirm = useConfirm();
//   if (!(await confirm({ title, body, confirmLabel: "Delete", danger: true }))) return;
//
// A native <dialog> opened with showModal() gives the focus trap, the inert page behind it,
// Escape and the backdrop. Enter confirms wherever focus sits; Escape and a click on the
// backdrop cancel. A dangerous question starts with focus on Cancel, any other on the action.
import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from "react";
import { type ConfirmOptions, createConfirmer } from "@/lib/confirm";

export type { ConfirmOptions };

type Ask = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<Ask | null>(null);

/** Ask the user a yes/no question in the app's dialog. Resolves true only when they confirm. */
export function useConfirm(): Ask {
  const ask = useContext(ConfirmContext);
  if (!ask) throw new Error("useConfirm() needs <ConfirmProvider> above it (app/layout.tsx).");
  return ask;
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const [confirmer] = useState(() => createConfirmer(setOpts));
  const ask = useCallback<Ask>((o) => confirmer.ask(o), [confirmer]);
  return (
    <ConfirmContext.Provider value={ask}>
      {children}
      <ConfirmDialog opts={opts} onAnswer={confirmer.settle} />
    </ConfirmContext.Provider>
  );
}

function ConfirmDialog({
  opts,
  onAnswer,
}: {
  opts: ConfirmOptions | null;
  onAnswer: (answer: boolean) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const actionRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const bodyId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (opts) {
      if (!dialog.open) dialog.showModal();
      (opts.danger ? cancelRef : actionRef).current?.focus();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [opts]);

  return (
    <dialog
      ref={ref}
      className="confirm-dialog"
      aria-labelledby={titleId}
      aria-describedby={opts?.body ? bodyId : undefined}
      // Escape: the browser fires `cancel`; answer it here and let the effect close the dialog.
      onCancel={(e) => {
        e.preventDefault();
        onAnswer(false);
      }}
      // The panel fills the dialog's box, so a click whose target is the dialog itself landed on
      // the backdrop around it.
      onClick={(e) => {
        if (e.target === e.currentTarget) onAnswer(false);
      }}
      onKeyDown={(e) => {
        // The page behind is inert, but window-level shortcuts (the canvas's Delete, Ctrl+K)
        // would still hear a key that bubbles out. The dialog keeps the keyboard to itself;
        // Escape's `cancel` is the browser's default action and still happens.
        e.stopPropagation();
        if (e.key !== "Enter" || e.repeat || e.nativeEvent.isComposing) return;
        e.preventDefault();
        onAnswer(true);
      }}
    >
      {opts ? (
        <div className="confirm-panel">
          <h2 id={titleId} className="confirm-title">
            {opts.title}
          </h2>
          {opts.body ? (
            <p id={bodyId} className="confirm-body">
              {opts.body}
            </p>
          ) : null}
          <div className="confirm-actions">
            <button
              ref={cancelRef}
              type="button"
              className="btn btn-ghost"
              onClick={() => onAnswer(false)}
            >
              {opts.cancelLabel ?? "Cancel"}
            </button>
            <button
              ref={actionRef}
              type="button"
              className={`btn ${opts.danger ? "btn-danger-solid" : "btn-primary"}`}
              onClick={() => onAnswer(true)}
            >
              {opts.confirmLabel}
            </button>
          </div>
        </div>
      ) : null}
    </dialog>
  );
}
