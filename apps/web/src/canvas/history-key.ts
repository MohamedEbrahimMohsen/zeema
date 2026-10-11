// Which history step a key press asks for. Ctrl/Cmd+Z undoes; Ctrl/Cmd+Shift+Z and Ctrl/Cmd+Y
// redo. Two things made undo look dead after a Shift drag:
// - the hand that has just Shift-dragged is often still on Shift, so its Ctrl+Z arrives as
//   Ctrl+Shift+Z: a redo, with nothing to redo (the drag's own step has just cleared the redo
//   stack). `shiftCarried` says Shift is still down from such a drag: the press is then an undo.
// - on Windows Ctrl+Shift can switch the keyboard layout, after which `key` is the letter of the
//   other script ("ئ", "я") and no longer "z". The physical key (`code`) is read as well.

type Press = {
  key: string;
  code?: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
};

/** The Latin letter a press stands for: its key, or the physical key on another layout. */
export function letterOf(ev: Pick<Press, "key" | "code">): string {
  const k = ev.key.toLowerCase();
  if (/^[a-z]$/.test(k)) return k;
  const m = /^Key([A-Z])$/.exec(ev.code ?? "");
  return m ? m[1].toLowerCase() : k;
}

export function historyKey(ev: Press, shiftCarried = false): "undo" | "redo" | null {
  if (!(ev.ctrlKey || ev.metaKey)) return null;
  const k = letterOf(ev);
  if (k === "z") return ev.shiftKey && !shiftCarried ? "redo" : "undo";
  if (k === "y") return "redo";
  return null;
}
