One-line: the dotted ground that every diagram sits on.

```jsx
<Canvas height={280}>
  <Boundary label="us-east-1 (region)" />
  <CanvasNode x={28} y={40} … />
</Canvas>
```

The dot grid is a 1px radial at 14% ink on a 24px pitch — visible enough to read as graph paper, faint enough that a node never fights it. Both values are tokens (`--canvas-dot`, `--canvas-dot-gap`); never hard-code a grid.
