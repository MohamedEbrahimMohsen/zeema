One-line: the canvas right-click menu.

```jsx
<ContextMenu items={[
  { label: "Group", shortcut: "G", active: true },
  { label: "Duplicate", shortcut: "⌃D" },
  { label: "Ungroup", shortcut: "⌃⇧G", disabled: true },
  { separator: true },
  { label: "Delete", shortcut: "⌫", danger: true },
]} />
```

Every item that has a keyboard route shows it, mono, right-aligned — Zeema assumes a keyboard user. Destructive items are separated and take `--err` text, never an `--err` fill. Floats on `--shadow-float`; the item radius is `calc(var(--rc) - 2px)` so it nests inside the menu's own corner.
