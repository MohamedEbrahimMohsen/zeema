// Reading and writing files. The page is served from the repository root by editor/serve.mjs,
// so a design is a GET away and a save is a PUT to the same path. There is no file picker and
// no download in the normal path: the editor writes the file the repository already has.

const abs = (p) => "/" + String(p).replace(/^\/+/, "");

export async function loadIndex() {
  const r = await fetch("data/designs.json", { cache: "no-cache" });
  if (!r.ok) throw new Error("designs.json missing; run node .claude/tools/build_editor_data.mjs");
  return r.json();
}

export async function loadCatalogue() {
  const [catalogue, search] = await Promise.all([
    fetch("data/catalogue.json", { cache: "no-cache" }).then((r) => r.json()),
    fetch("data/search.json", { cache: "no-cache" }).then((r) => r.json()),
  ]);
  return { catalogue, search };
}

// Icons are the biggest file and nothing needs them to draw the first frame, so they arrive
// after it and are patched into the scene when they land.
export async function loadIcons() {
  const r = await fetch("data/icons.json", { cache: "no-cache" });
  return r.ok ? r.json() : {};
}

export async function loadDesign(path) {
  const r = await fetch(abs(path), { cache: "no-cache" });
  if (!r.ok) throw new Error(`cannot read ${path}`);
  return r.text();
}

export async function loadLayout(path) {
  const r = await fetch(abs(path), { cache: "no-cache" });
  if (!r.ok) return null;
  try { return await r.json(); } catch { return null; }
}

export async function put(path, body) {
  const r = await fetch(abs(path), { method: "PUT", body });
  if (!r.ok) throw new Error(`${r.status}: ${await r.text()}`);
  return r.json();
}

export function download(name, text, type = "text/yaml") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
