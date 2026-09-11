One-line: renders a component kind's schema — property, type, default.

```jsx
<PropertyTable rows={[
  ["delivery", "enum", { label: "required", tone: "err" }],
  ["ordering", "enum", "none"],
]} />
```

Header is the section-label recipe (mono uppercase tracked); body is plain mono. `required` is the only value that takes `--err` — it marks an obligation, not a failure.
