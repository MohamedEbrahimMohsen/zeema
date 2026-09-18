One-line: wraps any inspector control with its label and its mono type hint.

```jsx
<Field label="delivery" hint="enum · required"><Select options={["at-least-once","exactly-once"]} /></Field>
<Field label="ordering" hint="enum · inherited from kind" inherited><TextInput placeholder="unset (none)" /></Field>
```

The hint is always mono and always reads `<type> · <provenance>`. Set `inherited` when the value comes from the kind — the label goes to `--muted` regular so a scan of the inspector shows at a glance what was explicitly set.
