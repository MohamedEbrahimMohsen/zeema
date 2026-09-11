One-line: a collapsible group of properties in the inspector.

```jsx
<Disclosure title="messaging" meta="· 1 set" open>
  <div style={{ fontFamily: "var(--mono)", color: "var(--muted)" }}>replay → <span style={{ color: "var(--ink)" }}>true</span></div>
</Disclosure>
```

Title is the property group's schema name, lowercase. The `meta` count is what lets a collapsed inspector still tell you where the configuration lives. Set values use the `key → value` mono form, key muted, value in `--ink`.
