One-line: wraps a run's findings with its severity tally.

```jsx
<FindingsPanel errors={2} warnings={1} info={0}>
  <Finding severity="err" message="…" rule="pubsub-replay-required" target="node events" />
</FindingsPanel>
```

The tally always shows all three counts, including zeros — a `0 info` tells you info checks ran. A count only takes its severity colour when it is non-zero.
