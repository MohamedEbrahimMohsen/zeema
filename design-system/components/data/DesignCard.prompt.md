One-line: the gallery tile for a published design.

```jsx
<DesignCard
  title="Order processing"
  description="Checkout to fulfilment with a replayable log."
  author="arkore" componentCount={9} provider="aws" clones={88}
  thumbnail={<MiniDiagram />}
/>
```

Three thumbnail treatments exist, in order of preference: a real mini-diagram built from taxonomy fills, a brand mark on a hatched ground, or a title plate on a taxonomy fill. Clone count always sits far right (`margin-left: auto`) so the strip has a stable anchor.
