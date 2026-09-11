One-line: a component instance on the canvas — the single most important object in the product.

```jsx
<CanvasNode x={28} y={40} label="orders" kind="sqs" taxonomy="green"
  icon="assets/icons/components/aws/sqs.svg" selected status="warn" port />
<CanvasNode x={194} y={40} label="fulfil" kind="worker" taxonomy="blue"
  icon="assets/icons/kinds/worker.svg" iconKind="kind" />
```

Three channels, three meanings, never crossed: **fill** is category, **border** is selection, **corner dot** is findings. A node keeps its category fill when selected — losing it would break the reading of the whole diagram. The name is sans medium; the kind beneath it is mono muted, because one is authored and the other is schema.
