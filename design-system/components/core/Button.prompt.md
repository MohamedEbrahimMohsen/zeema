One-line: the action control — use `primary` for the single committing action in a view, `secondary` for everything else.

```jsx
<Button variant="primary">New design</Button>
<Button>Clone</Button>
<Button variant="danger">Delete</Button>
<Button disabled>Save</Button>
```

Variants: `primary` (filled accent), `secondary` (panel + line — the default), `danger` (panel fill, `--err` label; Zeema never fills a destructive button red), `ghost` (toolbar/overflow use). Sizes `sm` | `md`. Disabled drops to 0.45 opacity rather than changing colour.
