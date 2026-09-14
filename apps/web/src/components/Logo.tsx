// The Arkore mark: an arch of seven blocks on the 24-grid, the keystone in the accent colour.
// `Mark` is the static logo; `Spinner` assembles the arch block by block, keystone last, on a
// 1.6 s cycle (keyframes `ark-build` in globals.css). Both inherit `currentColor` for the blocks
// and `--accent` for the keystone, so they follow the theme.

const ARCH =
  "M2.5 1H5.5A1.5 1.5 0 0 1 7 2.5V5.5A1.5 1.5 0 0 1 5.5 7H2.5A1.5 1.5 0 0 1 1 5.5V2.5A1.5 1.5 0 0 1 2.5 1ZM18.5 1H21.5A1.5 1.5 0 0 1 23 2.5V5.5A1.5 1.5 0 0 1 21.5 7H18.5A1.5 1.5 0 0 1 17 5.5V2.5A1.5 1.5 0 0 1 18.5 1ZM2.5 9H5.5A1.5 1.5 0 0 1 7 10.5V13.5A1.5 1.5 0 0 1 5.5 15H2.5A1.5 1.5 0 0 1 1 13.5V10.5A1.5 1.5 0 0 1 2.5 9ZM18.5 9H21.5A1.5 1.5 0 0 1 23 10.5V13.5A1.5 1.5 0 0 1 21.5 15H18.5A1.5 1.5 0 0 1 17 13.5V10.5A1.5 1.5 0 0 1 18.5 9ZM2.5 17H5.5A1.5 1.5 0 0 1 7 18.5V21.5A1.5 1.5 0 0 1 5.5 23H2.5A1.5 1.5 0 0 1 1 21.5V18.5A1.5 1.5 0 0 1 2.5 17ZM18.5 17H21.5A1.5 1.5 0 0 1 23 18.5V21.5A1.5 1.5 0 0 1 21.5 23H18.5A1.5 1.5 0 0 1 17 21.5V18.5A1.5 1.5 0 0 1 18.5 17Z";
const KEYSTONE =
  "M10.5 1H13.5A1.5 1.5 0 0 1 15 2.5V5.5A1.5 1.5 0 0 1 13.5 7H10.5A1.5 1.5 0 0 1 9 5.5V2.5A1.5 1.5 0 0 1 10.5 1Z";

export function Mark({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
      style={{ display: "block", flex: "none" }}
    >
      <path d={ARCH} fill="currentColor" />
      <path d={KEYSTONE} fill="var(--accent)" />
    </svg>
  );
}

// Build order bottom-up, keystone last: [x, y, delay step].
const BLOCKS: Array<[number, number, number]> = [
  [1, 17, 0],
  [17, 17, 0],
  [1, 9, 1],
  [17, 9, 1],
  [1, 1, 2],
  [17, 1, 2],
  [9, 1, 3],
];

export function Spinner({ size = 16, label = "Loading" }: { size?: number; label?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      role="img"
      aria-label={label}
      style={{ display: "block", flex: "none" }}
    >
      {BLOCKS.map(([x, y, step], i) => (
        <rect
          key={`${x}-${y}`}
          x={x}
          y={y}
          width={6}
          height={6}
          rx={1.5}
          fill={i === 6 ? "var(--accent)" : "currentColor"}
          style={{
            animation: "ark-build 1.6s cubic-bezier(0.2, 0, 0.2, 1) infinite",
            animationDelay: `${step * 0.18}s`,
          }}
        />
      ))}
    </svg>
  );
}
