"use client";

import { useEffect, useRef } from "react";

export type MenuItem =
  | { label: string; hint?: string; run: () => void; disabled?: boolean; danger?: boolean }
  | "-"
  | null;

/**
 * A menu at a point: the right-click menus, and the dropdowns the floating chrome opens under
 * its buttons. The first live item takes focus; the arrow keys, Home and End move through the
 * live items; Escape, a press outside and a lost window all close it. Where focus goes after
 * that is the opener's business (`onClose`).
 */
export function ContextMenu({
  x,
  y,
  items,
  onClose,
  label,
}: {
  x: number;
  y: number;
  items: MenuItem[];
  onClose: () => void;
  /** What the menu is, for a screen reader: the button that opened it names it. */
  label?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const away = (ev: PointerEvent) => {
      if (ref.current && !ref.current.contains(ev.target as Node)) onClose();
    };
    const key = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") onClose();
    };
    window.addEventListener("pointerdown", away, true);
    window.addEventListener("keydown", key, true);
    window.addEventListener("blur", onClose);
    return () => {
      window.removeEventListener("pointerdown", away, true);
      window.removeEventListener("keydown", key, true);
      window.removeEventListener("blur", onClose);
    };
  }, [onClose]);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.left = `${Math.max(8, Math.min(x, window.innerWidth - r.width - 8))}px`;
    el.style.top = `${Math.max(8, Math.min(y, window.innerHeight - r.height - 8))}px`;
  }, [x, y]);
  // Focus lands on the first item it can, so a keyboard opener can act at once.
  useEffect(() => {
    ref.current?.querySelector<HTMLButtonElement>("button:not([disabled])")?.focus();
  }, []);
  const move = (ev: React.KeyboardEvent<HTMLDivElement>) => {
    const live = [
      ...(ref.current?.querySelectorAll<HTMLButtonElement>("button:not([disabled])") ?? []),
    ];
    if (!live.length) return;
    const at = live.indexOf(document.activeElement as HTMLButtonElement);
    let next: number | null = null;
    if (ev.key === "ArrowDown") next = at < 0 ? 0 : (at + 1) % live.length;
    else if (ev.key === "ArrowUp")
      next = at < 0 ? live.length - 1 : (at - 1 + live.length) % live.length;
    else if (ev.key === "Home") next = 0;
    else if (ev.key === "End") next = live.length - 1;
    else if (ev.key === "Tab") {
      // A menu is one stop: Tab leaves it rather than walking through its items.
      onClose();
      return;
    }
    if (next === null) return;
    ev.preventDefault();
    // The canvas binds the arrow keys to nudging; inside a menu they belong to the menu.
    ev.stopPropagation();
    live[next].focus();
  };
  const list = items.filter(Boolean) as Exclude<MenuItem, null>[];
  return (
    <div
      ref={ref}
      className="zeema-menu"
      role="menu"
      aria-label={label}
      style={{ left: x, top: y }}
      onKeyDown={move}
    >
      {list.map((item, i) =>
        item === "-" ? (
          <div key={`sep-${i}`} className="sep" />
        ) : (
          <button
            key={item.label}
            type="button"
            role="menuitem"
            className={item.danger ? "danger" : ""}
            disabled={item.disabled}
            onClick={() => {
              onClose();
              item.run();
            }}
          >
            <span>{item.label}</span>
            {item.hint ? <span className="hint">{item.hint}</span> : null}
          </button>
        ),
      )}
    </div>
  );
}
