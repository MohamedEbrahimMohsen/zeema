// The promise behind the in-app confirmation dialog, kept free of React and the DOM so it can be
// tested on its own. `ask` hands the request to whoever draws the dialog and returns a promise
// that `settle` answers. One question at a time: asking again while one is open answers the
// earlier one "no", so no caller is ever left waiting on a dialog that is no longer on screen.

export type ConfirmOptions = {
  title: string;
  body?: string;
  confirmLabel: string;
  cancelLabel?: string;
  /** Destructive: the action button is red and Cancel takes the initial focus. */
  danger?: boolean;
  /** A notice, not a question: only the action button is shown (it still answers true). */
  alert?: boolean;
};

export function createConfirmer(show: (opts: ConfirmOptions | null) => void) {
  let pending: ((answer: boolean) => void) | null = null;

  const settle = (answer: boolean) => {
    const resolve = pending;
    if (!resolve) return;
    pending = null;
    show(null);
    resolve(answer);
  };

  const ask = (opts: ConfirmOptions) => {
    settle(false);
    return new Promise<boolean>((resolve) => {
      pending = resolve;
      show(opts);
    });
  };

  return { ask, settle };
}
