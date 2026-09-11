One-line: nothing-here states — dashed inline for a region, solid panel for a page.

```jsx
<EmptyState>Nothing matches. Try a product name, or <span style={{fontFamily:"var(--mono)"}}>kind:queue</span>.</EmptyState>

<EmptyState variant="panel" title="Not found" action={<Button>Browse designs</Button>}>
  There is no design or person at this address, or it is private.
</EmptyState>
```

Inline empties suggest the *next query*, in mono, rather than apologising. Panel empties state the two possible causes plainly and offer one way out. No illustrations, no icons.
