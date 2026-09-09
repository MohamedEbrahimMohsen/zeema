// The right click menu. One at a time, positioned at the pointer, kept inside the window, and
// closed by anything that is not choosing from it. Items are plain data so the caller decides
// what a right click on a node, an edge, a boundary or the empty canvas offers.

let open = null;

export function closeMenu() {
  if (!open) return;
  open.el.remove();
  window.removeEventListener("pointerdown", open.away, true);
  window.removeEventListener("keydown", open.key, true);
  window.removeEventListener("blur", closeMenu);
  open = null;
}

// items: { label, hint, run, disabled, danger } | "-"
export function showMenu(x, y, items) {
  closeMenu();
  const list = items.filter(Boolean);
  if (!list.some((i) => i !== "-")) return;

  const el = document.createElement("div");
  el.className = "menu";
  el.setAttribute("role", "menu");
  for (const item of list) {
    if (item === "-") { el.append(Object.assign(document.createElement("div"), { className: "menu-sep" })); continue; }
    const b = document.createElement("button");
    b.className = "menu-item" + (item.danger ? " danger" : "");
    b.disabled = !!item.disabled;
    b.append(Object.assign(document.createElement("span"), { className: "menu-label", textContent: item.label }));
    if (item.hint) b.append(Object.assign(document.createElement("span"), { className: "menu-hint", textContent: item.hint }));
    b.addEventListener("click", () => { closeMenu(); item.run(); });
    el.append(b);
  }
  document.body.append(el);

  const r = el.getBoundingClientRect();
  el.style.left = Math.max(8, Math.min(x, (window.innerWidth || x + r.width + 16) - r.width - 8)) + "px";
  el.style.top = Math.max(8, Math.min(y, (window.innerHeight || y + r.height + 16) - r.height - 8)) + "px";

  const away = (ev) => { if (!el.contains(ev.target)) closeMenu(); };
  const key = (ev) => { if (ev.key === "Escape") { ev.stopPropagation(); closeMenu(); } };
  open = { el, away, key };
  window.addEventListener("pointerdown", away, true);
  window.addEventListener("keydown", key, true);
  window.addEventListener("blur", closeMenu);
}
