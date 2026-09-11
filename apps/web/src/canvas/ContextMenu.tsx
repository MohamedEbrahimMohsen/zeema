"use client";

import { useEffect, useRef } from "react";

export type MenuItem =
  | { label: string; hint?: string; run: () => void; disabled?: boolean; danger?: boolean }
  | "-"
  | null;

export function ContextMenu({
  x,
  y,
  items,
  onClose,
}: {
  x: number;
  y: number;
  items: MenuItem[];
  onClose: () => void;
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
  const list = items.filter(Boolean) as Exclude<MenuItem, null>[];
  return (
    <div ref={ref} className="arkore-menu" role="menu" style={{ left: x, top: y }}>
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
