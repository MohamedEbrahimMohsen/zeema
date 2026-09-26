"use client";

// Keyboard and dismissal for the site's dropdown menus, mirroring the canvas's ContextMenu: the
// first live item takes focus when the menu opens; the arrow keys, Home and End move through the
// live items; Tab leaves the menu (it is one stop); Escape and a press outside close it. Escape
// hands focus back to the button that opened the menu, a press outside does not.
import { type KeyboardEvent, type RefObject, useCallback, useEffect } from "react";

const ITEMS = '[role^="menuitem"]:not([disabled]):not([aria-disabled="true"])';

export function useMenuKeys({
  open,
  close,
  root,
  menu,
}: {
  open: boolean;
  /** Closes the menu; `refocus` asks for focus to go back to the opener. */
  close: (refocus: boolean) => void;
  /** The opener and the menu together: a press inside it is not a press outside. */
  root: RefObject<HTMLElement | null>;
  menu: RefObject<HTMLElement | null>;
}) {
  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector<HTMLElement>(ITEMS)?.focus();
    const away = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) close(false);
    };
    const esc = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") close(true);
    };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open, close, root, menu]);

  return useCallback(
    (e: KeyboardEvent<HTMLElement>) => {
      if (e.key === "Tab") {
        close(false);
        return;
      }
      const live = [...(menu.current?.querySelectorAll<HTMLElement>(ITEMS) ?? [])];
      if (!live.length) return;
      const at = live.indexOf(document.activeElement as HTMLElement);
      let next: number | null = null;
      if (e.key === "ArrowDown") next = at < 0 ? 0 : (at + 1) % live.length;
      else if (e.key === "ArrowUp")
        next = at < 0 ? live.length - 1 : (at - 1 + live.length) % live.length;
      else if (e.key === "Home") next = 0;
      else if (e.key === "End") next = live.length - 1;
      if (next === null) return;
      e.preventDefault();
      live[next].focus();
    },
    [close, menu],
  );
}
