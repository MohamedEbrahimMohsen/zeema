// The Zeema mark: a Z inside braces — the letter as a value, the braces as the schema around
// it. Two colours only, the brand blue and white, so the mark is the same object everywhere
// rather than a different drawing per surface.
//
// `Mark` is the tile: white strokes reversed out of the blue field, which is what makes it
// legible down to favicon size where open strokes would break up. `Spinner` keeps the braces
// and draws the Z through them on a 1.4 s loop (keyframes `zee-draw` in globals.css).

const BRACE_LEFT =
  "M7.3 5C5.9 5 5.6 5.8 5.6 7.1V10.2C5.6 11.3 4.9 11.9 3.6 12C4.9 12.1 5.6 12.7 5.6 13.8V16.9C5.6 18.2 5.9 19 7.3 19";
const BRACE_RIGHT =
  "M16.7 5C18.1 5 18.4 5.8 18.4 7.1V10.2C18.4 11.3 19.1 11.9 20.4 12C19.1 12.1 18.4 12.7 18.4 13.8V16.9C18.4 18.2 18.1 19 16.7 19";
const ZED = "M8.9 8.1H15.1L8.9 15.9H15.1";

const BLUE = "#3f4fc4";
const STROKE = { strokeWidth: 2.3, strokeLinecap: "round", strokeLinejoin: "round" } as const;

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
      <rect width="24" height="24" rx="5" fill={BLUE} />
      <g fill="none" stroke="#fff" {...STROKE}>
        <path d={BRACE_LEFT} />
        <path d={BRACE_RIGHT} />
        <path d={ZED} />
      </g>
    </svg>
  );
}

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
      <rect width="24" height="24" rx="5" fill={BLUE} />
      <g fill="none" stroke="#fff" {...STROKE}>
        <g opacity={0.45}>
          <path d={BRACE_LEFT} />
          <path d={BRACE_RIGHT} />
        </g>
        <path
          d={ZED}
          // The path is a shade under 20 units long; the dash carries the whole stroke.
          strokeDasharray={20}
          style={{ animation: "zee-draw 1.4s cubic-bezier(0.4, 0, 0.3, 1) infinite" }}
        />
      </g>
    </svg>
  );
}
