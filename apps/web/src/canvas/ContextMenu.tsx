"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChevronRight } from "@/components/Glyphs";
import { flyoutPosition, type MenuEntry, type MenuModel, tidy } from "./menu-model";
import { Switch } from "./Switch";

export type { MenuEntry, MenuModel } from "./menu-model";

type SwitchModel = Extract<MenuModel, { kind: "switch" }>;
type SubmenuModel = Extract<MenuModel, { kind: "submenu" }>;

// How long the pointer rests on a row before its submenu opens (or a sibling's closes), and how
// long it may be outside a row and its flyout before the flyout goes.
const HOVER_INTENT = 120;
const LEAVE_GRACE = 300;

// The menu is a snapshot of its items; the row keeps its own state so a click shows at once.
function MenuCheckRow({ item }: { item: SwitchModel }) {
  const [on, setOn] = useState(item.checked);
  const [set, setSet] = useState(false);
  const hint = item.hintUntilSet && set ? undefined : item.hint;
  return (
    <Switch
      className="menu-switch"
      role="menuitemcheckbox"
      label={item.label}
      hint={hint ?? item.shortcut}
      checked={on}
      onChange={(next) => {
        setOn(next);
        setSet(true);
        item.onChange(next);
      }}
    />
  );
}

/** What every panel of one menu shares: which submenus are open, and how to close it all. */
type Ctx = {
  /** The key of the open submenu at each depth: open[0] is in the top panel. */
  open: string[];
  setOpen: (next: (prev: string[]) => string[]) => void;
  /** Run `fn` after `ms`, replacing whatever was waiting; null only cancels. */
  later: (fn: (() => void) | null, ms?: number) => void;
  /** The depth whose panel takes focus on its first item when it mounts (a keyboard opener). */
  focusDepth: React.MutableRefObject<number | null>;
  close: () => void;
  root: React.RefObject<HTMLDivElement | null>;
};

const LIVE = "button:not([disabled])";
// A panel's own rows, not those of a flyout nested inside it.
const OWN = ":scope > button:not([disabled]), :scope > .menu-sub > button:not([disabled])";

const rowFor = (ctx: Ctx, key: string) =>
  ctx.root.current?.querySelector<HTMLElement>(`[data-menu-key="${key}"]`) ?? null;

const isMouse = (ev: React.PointerEvent) => ev.pointerType === "mouse" || ev.pointerType === "pen";

function Panel({
  items,
  depth,
  prefix,
  ctx,
  label,
  panelRef,
  style,
}: {
  items: MenuModel[];
  depth: number;
  prefix: string;
  ctx: Ctx;
  label?: string;
  panelRef?: React.RefObject<HTMLDivElement | null>;
  style?: React.CSSProperties;
}) {
  const own = useRef<HTMLDivElement>(null);
  const ref = panelRef ?? own;

  const rows = () => [...(ref.current?.querySelectorAll<HTMLElement>(OWN) ?? [])];

  const onKeyDown = (ev: React.KeyboardEvent<HTMLDivElement>) => {
    const live = rows();
    const active = document.activeElement as HTMLElement | null;
    const at = active ? live.indexOf(active) : -1;
    // A key from a deeper panel that it did not take: not this panel's to answer, except Tab.
    if (at < 0 && active && ref.current?.contains(active) && ev.key !== "Tab") return;
    if (ev.key === "Tab") {
      // A menu is one stop: Tab leaves it rather than walking through its items.
      ctx.close();
      return;
    }
    let next: number | null = null;
    const key = active?.dataset.menuKey;
    if (ev.key === "ArrowDown") next = at < 0 ? 0 : (at + 1) % live.length;
    else if (ev.key === "ArrowUp")
      next = at < 0 ? live.length - 1 : (at - 1 + live.length) % live.length;
    else if (ev.key === "Home") next = 0;
    else if (ev.key === "End") next = live.length - 1;
    else if (ev.key === "ArrowRight" && key) {
      ctx.focusDepth.current = depth + 1;
      ctx.setOpen((prev) => [...prev.slice(0, depth), key]);
    } else if (ev.key === "ArrowLeft" && depth > 0) {
      const parent = ctx.open[depth - 1];
      ctx.setOpen((prev) => prev.slice(0, depth - 1));
      if (parent) rowFor(ctx, parent)?.focus();
    } else if (ev.key.length === 1 && /\S/.test(ev.key) && !ev.ctrlKey && !ev.metaKey) {
      // Type-ahead: the next row whose label starts with the letter.
      const ch = ev.key.toLowerCase();
      const text = (el: HTMLElement) =>
        (el.querySelector(".menu-label, .switch-label")?.textContent ?? "").trim().toLowerCase();
      for (let i = 1; i <= live.length; i++) {
        const j = (Math.max(at, -1) + i) % live.length;
        if (text(live[j]).startsWith(ch)) {
          next = j;
          break;
        }
      }
      if (next === null) return;
    } else return;
    ev.preventDefault();
    // The canvas binds the arrow keys to nudging; inside a menu they belong to the menu.
    ev.stopPropagation();
    if (next === null || !live.length) return;
    // Moving within a level puts away a flyout this level had open.
    ctx.setOpen((prev) => prev.slice(0, depth));
    live[next].focus();
  };

  // The pointer resting on a row focuses it at once, and after a moment opens its submenu or
  // closes a sibling's. Touch has no hover: a tap is a click.
  const onPointerOver = (ev: React.PointerEvent<HTMLDivElement>) => {
    if (!isMouse(ev)) return;
    const btn = (ev.target as Element).closest("button");
    if (!btn || btn.disabled || btn.closest(".zeema-menu") !== ref.current) return;
    if (btn !== document.activeElement) btn.focus({ preventScroll: true });
    const key = btn.dataset.menuKey;
    ctx.later(
      () => ctx.setOpen((prev) => (key ? [...prev.slice(0, depth), key] : prev.slice(0, depth))),
      HOVER_INTENT,
    );
  };

  useEffect(() => {
    if (ctx.focusDepth.current !== depth) return;
    ctx.focusDepth.current = null;
    ref.current?.querySelector<HTMLElement>(OWN)?.focus();
  }, [ctx, depth, ref]);

  return (
    <div
      ref={ref}
      className={`zeema-menu${depth ? " zeema-flyout" : ""}`}
      role="menu"
      aria-label={label}
      aria-orientation="vertical"
      style={style}
      onKeyDown={onKeyDown}
      onPointerOver={onPointerOver}
    >
      {items.map((item, i) => {
        const key = `${prefix}${i}`;
        if (item.kind === "separator") return <div key={key} className="sep" />;
        if (item.kind === "switch") return <MenuCheckRow key={key} item={item} />;
        if (item.kind === "submenu")
          return <SubmenuRow key={key} item={item} k={key} depth={depth} ctx={ctx} />;
        return (
          <button
            key={key}
            type="button"
            role="menuitem"
            className={item.danger ? "danger" : ""}
            disabled={item.disabled}
            onClick={() => {
              ctx.close();
              item.run();
            }}
          >
            <MenuText label={item.label} hint={item.hint} />
            {item.shortcut ? <span className="hint">{item.shortcut}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

const MenuText = ({ label, hint }: { label: string; hint?: string }) => (
  <span className="menu-text">
    <span className="menu-label">{label}</span>
    {hint ? <span className="menu-hint">{hint}</span> : null}
  </span>
);

function SubmenuRow({
  item,
  k,
  depth,
  ctx,
}: {
  item: SubmenuModel;
  k: string;
  depth: number;
  ctx: Ctx;
}) {
  const expanded = ctx.open[depth] === k;
  const rowRef = useRef<HTMLButtonElement>(null);
  const flyRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const items = tidy(item.items);

  // Placed once it can be measured: beside the panel it came from, kept on screen.
  useLayoutEffect(() => {
    if (!expanded) {
      setPos(null);
      return;
    }
    const row = rowRef.current?.getBoundingClientRect();
    const panel = rowRef.current?.closest(".zeema-menu")?.getBoundingClientRect();
    const fly = flyRef.current?.getBoundingClientRect();
    if (!row || !panel || !fly) return;
    const p = flyoutPosition(
      { left: panel.left, right: panel.right, top: row.top, bottom: row.bottom },
      { width: fly.width, height: fly.height },
      { width: window.innerWidth, height: window.innerHeight },
    );
    setPos({ left: p.left, top: p.top });
  }, [expanded]);

  return (
    <div
      className="menu-sub"
      role="none"
      onPointerEnter={(ev) => {
        if (isMouse(ev)) ctx.later(null);
      }}
      onPointerLeave={(ev) => {
        if (!isMouse(ev)) return;
        ctx.later(
          () => ctx.setOpen((prev) => (prev[depth] === k ? prev.slice(0, depth) : prev)),
          LEAVE_GRACE,
        );
      }}
    >
      <button
        ref={rowRef}
        type="button"
        role="menuitem"
        aria-haspopup="menu"
        aria-expanded={expanded}
        data-menu-key={k}
        className={expanded ? "menu-sub is-open" : "menu-sub"}
        disabled={item.disabled || !items.length}
        onClick={(ev) => {
          ctx.later(null);
          // A keyboard press (Enter, Space) carries no click count: it moves into the flyout.
          if (ev.detail === 0) ctx.focusDepth.current = depth + 1;
          ctx.setOpen((prev) =>
            prev[depth] === k && ev.detail !== 0
              ? prev.slice(0, depth)
              : [...prev.slice(0, depth), k],
          );
        }}
      >
        <MenuText label={item.label} hint={item.hint} />
        <span className="menu-chevron" aria-hidden="true">
          <ChevronRight />
        </span>
      </button>
      {expanded ? (
        <Panel
          items={items}
          depth={depth + 1}
          prefix={`${k}.`}
          ctx={ctx}
          label={item.label}
          panelRef={flyRef}
          // Unplaced, it is measured where it cannot be seen; opacity, not visibility, so it can
          // already take focus.
          style={pos ? { left: pos.left, top: pos.top } : { opacity: 0, left: 0, top: 0 }}
        />
      ) : null}
    </div>
  );
}

/**
 * A menu at a point: the right-click menus, and the dropdowns the floating chrome opens under
 * its buttons. Items are a tree (`MenuModel`): a submenu row opens a flyout beside it on hover,
 * on click, Enter or the right arrow, and the left arrow or Escape steps back out. The first live
 * item takes focus; the arrows, Home, End and a first letter move within a level; Escape at the
 * top, a press outside and a lost window close it. Where focus goes after that is the opener's
 * business (`onClose`).
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
  items: MenuEntry[];
  onClose: () => void;
  /** What the menu is, for a screen reader: the button that opened it names it. */
  label?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpenState] = useState<string[]>([]);
  const openRef = useRef(open);
  openRef.current = open;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const focusDepth = useRef<number | null>(null);
  const ctx: Ctx = {
    open,
    setOpen: (fn) => setOpenState((prev) => fn(prev)),
    later: (fn, ms = 0) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = fn ? setTimeout(fn, ms) : null;
    },
    focusDepth,
    close: onClose,
    root: ref,
  };

  useEffect(() => {
    const away = (ev: PointerEvent) => {
      if (ref.current && !ref.current.contains(ev.target as Node)) onClose();
    };
    // Escape steps out of the innermost flyout, back to its row; at the top it closes the menu.
    const key = (ev: KeyboardEvent) => {
      if (ev.key !== "Escape") return;
      const path = openRef.current;
      if (!path.length) {
        onClose();
        return;
      }
      ev.preventDefault();
      ev.stopPropagation();
      const last = path[path.length - 1];
      setOpenState(path.slice(0, -1));
      ref.current?.querySelector<HTMLElement>(`[data-menu-key="${last}"]`)?.focus();
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
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
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
  return (
    <Panel
      items={tidy(items)}
      depth={0}
      prefix=""
      ctx={ctx}
      label={label}
      panelRef={ref}
      style={{ left: x, top: y }}
    />
  );
}
