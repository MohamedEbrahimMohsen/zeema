One-line: inline persistence state next to a title or toolbar.

```jsx
<StatusText>saving…</StatusText>
<StatusText tone="ok">saved</StatusText>
<StatusText tone="warn">unsaved</StatusText>
<StatusText tone="err">conflict</StatusText>
```

Lowercase, no punctuation, no icon. `saving…` uses a real ellipsis character.
