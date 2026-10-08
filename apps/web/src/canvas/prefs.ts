// The canvas's on/off habits: they live in this browser, not in the design, and apply to every
// canvas the person opens. A storage that refuses to answer (private windows, blocked site data)
// never stops the canvas: reads fall back to the default, writes are dropped.

type Store = Pick<Storage, "getItem" | "setItem">;

const local = (): Store | null => {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
};

/** A stored "on" / "off", or `fallback` when nothing (or nothing readable) is stored. */
export const readFlag = (key: string, fallback: boolean, store = local()): boolean => {
  try {
    const v = store?.getItem(key);
    return v === "on" ? true : v === "off" ? false : fallback;
  } catch {
    return fallback;
  }
};

export const writeFlag = (key: string, on: boolean, store = local()) => {
  try {
    store?.setItem(key, on ? "on" : "off");
  } catch {
    /* a browser that will not remember is still a browser that works */
  }
};

/** Hover cards on components and edges: on unless this browser was told otherwise. */
export const HOVER_CARDS_KEY = "zeema.canvas.hoverCards";
export const readHoverCards = (store = local()) => readFlag(HOVER_CARDS_KEY, true, store);
export const writeHoverCards = (on: boolean, store = local()) =>
  writeFlag(HOVER_CARDS_KEY, on, store);

/**
 * A design with more edges than this draws them at reduced ink while no choice is stored
 * ("auto"): the picture stays calm until a hover, a pin or a selected edge asks for one of them.
 */
export const DIM_EDGES_OVER = 15;
/** Dim the edges: by the count above (nothing stored yet), always, or never. */
export type DimEdges = "auto" | "on" | "off";
export const DIM_KEY = "zeema.canvas.dimEdges";

/** What this browser chose; "auto" until the first click stores an explicit on or off. */
export const readDim = (store = local()): DimEdges => {
  try {
    const v = store?.getItem(DIM_KEY);
    return v === "on" || v === "off" ? v : "auto";
  } catch {
    return "auto";
  }
};

export const writeDim = (on: boolean, store = local()) => writeFlag(DIM_KEY, on, store);

/** Whether the edges are dimmed: what the checkbox shows, and what the scene draws. */
export const dimmed = (mode: DimEdges, edgeCount: number) =>
  mode === "on" || (mode === "auto" && edgeCount > DIM_EDGES_OVER);
