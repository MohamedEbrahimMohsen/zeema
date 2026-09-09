// Getting a design out of the page: as SVG, which is the drawing itself, or as PNG or JPEG,
// which is the drawing painted onto a canvas at whatever scale was asked for.
//
// The raster path goes through a blob URL rather than a data URI, because a large design with
// icons in it makes a string megabytes long and Safari refuses those. A blob URL is same origin,
// so the canvas it is drawn onto is not tainted and can still be read back.

export const FORMATS = {
  svg: { ext: "svg", mime: "image/svg+xml" },
  png: { ext: "png", mime: "image/png" },
  jpg: { ext: "jpg", mime: "image/jpeg" },
};

// The browser will not rasterise an SVG that has no intrinsic size, and it will not wait for
// one that never loads, so both are turned into an error the caller can put on screen.
function load(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("the drawing could not be read back as an image"));
    img.src = url;
  });
}

export async function rasterise(svgText, { mime, scale = 2, background = null, quality = 0.92 } = {}) {
  const url = URL.createObjectURL(new Blob([svgText], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const img = await load(url);
    const w = Math.max(1, Math.round((img.naturalWidth || 800) * scale));
    const h = Math.max(1, Math.round((img.naturalHeight || 600) * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");
    // JPEG has no transparency: without this the empty parts come out black rather than blank.
    if (background) { ctx.fillStyle = background; ctx.fillRect(0, 0, w, h); }
    ctx.drawImage(img, 0, 0, w, h);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, mime, quality));
    if (!blob) throw new Error(`this browser cannot write ${mime}`);
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function save(name, data, mime) {
  const blob = data instanceof Blob ? data : new Blob([data], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// One entry point for all three: the SVG is the source in every case, so the raster formats can
// never drift from the vector one.
export async function exportScene(scene, id, format, { scale = 2 } = {}) {
  const spec = FORMATS[format];
  if (!spec) throw new Error(`unknown format ${format}`);
  const svgText = scene.toSVG({ background: true });
  if (format === "svg") { save(`${id}.svg`, svgText, spec.mime); return { bytes: svgText.length }; }
  const blob = await rasterise(svgText, { mime: spec.mime, scale, background: scene.cssVar("--bg") || "#ffffff" });
  save(`${id}.${spec.ext}`, blob, spec.mime);
  return { bytes: blob.size };
}
