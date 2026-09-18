One-line: one rule violation, stated as a sentence and then as coordinates.

```jsx
<Finding severity="err"
  message="Cache 'session' is the primary store for its data but has persistence disabled."
  rule="cache-as-primary-store-without-persistence" target="node session" />
```

The message is a complete sentence that names the node in single quotes and says what is wrong *and* why it matters. The mono line underneath is the rule id and the target — that is what makes a finding actionable and linkable. Severity tints both the dot and the mono line.
