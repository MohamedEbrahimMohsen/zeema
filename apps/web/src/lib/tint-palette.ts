// The boundary colour popover's fixed palette and the colours this browser applied lately.
// A hex tint is used as it is in both themes, so the shades sit in the middle of each ramp,
// where a dashed stroke and a light fill read on the light and the dark canvas alike.
import type { HexTint } from "./layout-sidecar";
import { isHexTint } from "./layout-sidecar";

/** Columns, left to right. */
export const PALETTE_HUES = [
  "red",
  "orange",
  "yellow",
  "green",
  "teal",
  "blue",
  "violet",
  "pink",
] as const;

/** Shades per hue, light to dark; `PALETTE_SHADES[hue][i]` is row `i`. */
const PALETTE_SHADES: Record<(typeof PALETTE_HUES)[number], HexTint[]> = {
  red: ["#fca5a5", "#f87171", "#ef4444", "#dc2626", "#b91c1c"],
  orange: ["#fdba74", "#fb923c", "#f97316", "#ea580c", "#c2410c"],
  yellow: ["#fde047", "#facc15", "#eab308", "#ca8a04", "#a16207"],
  green: ["#86efac", "#4ade80", "#22c55e", "#16a34a", "#15803d"],
  teal: ["#5eead4", "#2dd4bf", "#14b8a6", "#0d9488", "#0f766e"],
  blue: ["#93c5fd", "#60a5fa", "#3b82f6", "#2563eb", "#1d4ed8"],
  violet: ["#c4b5fd", "#a78bfa", "#8b5cf6", "#7c3aed", "#6d28d9"],
  pink: ["#f9a8d4", "#f472b6", "#ec4899", "#db2777", "#be185d"],
};

/** Greys, light to dark: the last row. */
const PALETTE_GREYS: HexTint[] = [
  "#ffffff",
  "#d4d4d4",
  "#a3a3a3",
  "#737373",
  "#525252",
  "#404040",
  "#262626",
  "#000000",
];

export const PALETTE_COLUMNS = PALETTE_HUES.length;

/** The grid row by row: one row per shade across the hues, then the greys. */
export const PALETTE_ROWS: HexTint[][] = [
  ...PALETTE_SHADES.red.map((_, i) => PALETTE_HUES.map((h) => PALETTE_SHADES[h][i])),
  PALETTE_GREYS,
];

/** Every palette colour, in grid order. */
export const PALETTE: HexTint[] = PALETTE_ROWS.flat();

export const RECENT_KEY = "zeema.tint.recent";
export const RECENT_MAX = 8;

type RecentStorage = Pick<Storage, "getItem" | "setItem">;

/** `localStorage`, or null where reading it throws (private windows, blocked site data). */
export function browserStorage(): RecentStorage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** The recent colours, most recent first. Anything unreadable is an empty list. */
export function readRecent(storage: RecentStorage | null = browserStorage()): HexTint[] {
  if (!storage) return [];
  try {
    const raw = JSON.parse(storage.getItem(RECENT_KEY) ?? "[]");
    if (!Array.isArray(raw)) return [];
    const out: HexTint[] = [];
    for (const v of raw) {
      if (!isHexTint(v)) continue;
      const hex = v.toLowerCase() as HexTint;
      if (!out.includes(hex)) out.push(hex);
      if (out.length === RECENT_MAX) break;
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * Put a colour at the front of the recent list, dropping its older copy and anything past
 * eight, and store it. Returns the new list; a storage that throws still gets that list back.
 */
export function pushRecent(
  hex: HexTint,
  storage: RecentStorage | null = browserStorage(),
): HexTint[] {
  const v = hex.toLowerCase() as HexTint;
  if (!isHexTint(v)) return readRecent(storage);
  const next = [v, ...readRecent(storage).filter((h) => h !== v)].slice(0, RECENT_MAX);
  try {
    storage?.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // Nowhere to keep it; the list still holds for this session.
  }
  return next;
}
