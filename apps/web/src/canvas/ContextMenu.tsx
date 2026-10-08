"use client";

import { useEffect, useRef, useState } from "react";
import { Switch } from "./Switch";

/** An on/off choice in a menu: a switch row that flips in place and leaves the menu open. */
export type MenuCheck = {
  label: string;
  hint?: string;
  /** The hint says how an unset choice decides ("auto"): it goes once the row is clicked. */
  hintUntilSet?: boolean;
  checked: boolean;
  toggle: (on: boolean) => void;
};

export type MenuItem =
  | { label: string; hint?: string; run: () => void; disabled?: boolean; danger?: boolean }
  | MenuCheck
  | "-"
  | null;

// The menu is a snapshot of its items; the row keeps its own state so a click shows at once.
function MenuCheckRow({ item }: { item: MenuCheck }) {
  const [on, setOn] = useState(item.checked);
  const [set, setSet] = useState(false);
  return (
    <Switch
      className="menu-switch"
      role="menuitemcheckbox"
      label={item.label}
      hint={item.hintUntilSet && set ? undefined : item.hint}
      checked={on}
      onChange={(next) => {
        setOn(next);
        setSet(true);
        item.toggle(next);
      }}
    />
  );
}

const LIVE = "button:not([disabled])";

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
    ref.current?.querySelector<HTMLElement>(LIVE)?.focus();
  }, []);
  const move = (ev: React.KeyboardEvent<HTMLDivElement>) => {
    const live = [...(ref.current?.querySelectorAll<HTMLElement>(LIVE) ?? [])];
    if (!live.length) return;
    const at = live.indexOf(document.activeElement as HTMLElement);
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
        ) : "checked" in item ? (
          <MenuCheckRow key={item.label} item={item} />
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
