// Getting a design out of the page: SVG, which is the drawing itself, or PNG, which is the
// drawing painted onto a canvas. The SVG is the source in both cases so they cannot drift.
import type { Scene } from "./scene";

function load(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("the drawing could not be read back as an image"));
    img.src = url;
  });
}

export async function rasterise(
  svgText: string,
  { mime = "image/png", scale = 2, background = null as string | null, quality = 0.92 } = {},
) {
  const url = URL.createObjectURL(new Blob([svgText], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const img = await load(url);
    const w = Math.max(1, Math.round((img.naturalWidth || 800) * scale));
    const h = Math.max(1, Math.round((img.naturalHeight || 600) * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    if (background) {
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, w, h);
    }
    ctx.drawImage(img, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mime, quality));
    if (!blob) throw new Error(`this browser cannot write ${mime}`);
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function saveFile(name: string, data: Blob | string, mime: string) {
  const blob = data instanceof Blob ? data : new Blob([data], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// A diagram going into a document should not come out dark for having been exported in the
// evening: with no explicit theme choice the export is drawn light.
function withPalette<T>(run: (palette: string) => T) {
  const root = document.documentElement;
  const chosen = root.getAttribute("data-theme");
  if (!chosen) root.setAttribute("data-theme", "light");
  try {
    return run(chosen || "light");
  } finally {
    if (!chosen) root.removeAttribute("data-theme");
  }
}

export async function exportScene(
  scene: Scene,
  id: string,
  format: "svg" | "png",
  { scale = 2 } = {},
) {
  const { svgText, ground } = withPalette((palette) => ({
    svgText: scene.toSVG({ background: format !== "svg" || palette === "dark" }),
    ground: scene.cssVar("--bg") || "#ffffff",
  }));
  if (format === "svg") {
    saveFile(`${id}.svg`, svgText, "image/svg+xml");
    return;
  }
  const blob = await rasterise(svgText, { mime: "image/png", scale, background: ground });
  saveFile(`${id}.png`, blob, "image/png");
}
