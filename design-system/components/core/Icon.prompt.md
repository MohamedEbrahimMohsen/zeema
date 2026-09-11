One-line: the only sanctioned way to render an Arkore glyph — it encodes which icons may be recoloured and which may not.

```jsx
<Icon src="assets/icons/components/aws/sqs.svg" />
<Icon src="assets/icons/kinds/worker.svg" kind="kind" color="var(--muted)" />
<Icon src="assets/icons/providers/aws.svg" kind="provider" size="var(--icon-sm)" />
```

Never recolour a `component` mark — vendor brand colour is the identity signal in a canvas full of neutral boxes. `kind` glyphs are masked, so they inherit tone and work on any fill. `provider` logos pass through `--icon-filter`, which inverts them in dark mode.
