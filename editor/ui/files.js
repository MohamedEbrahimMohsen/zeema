// Reading and writing files. The page is served from the repository root by editor/serve.mjs,
// so a design is a GET away and a save is a PUT to the same path. There is no file picker and
// no download here: the editor writes the file the repository already has, and getting a
// drawing out of the page is export.js's job.

const abs = (p) => "/" + String(p).replace(/^\/+/, "");
// The page can be at /editor/ or at /editor/imported/chat-system, so the generated bundle is
// addressed from this module rather than from whatever the address bar happens to say.
const asset = (name) => new URL("../data/" + name, import.meta.url).pathname;

// The server lists the design folders live, so a design created a minute ago is there. The
// committed bundle is the fallback for anything serving these files statically.
export async function loadIndex() {
  try {
    const live = await fetch("/api/designs", { cache: "no-cache" });
    if (live.ok) return live.json();
  } catch { /* fall through to the snapshot */ }
  const r = await fetch(asset("designs.json"), { cache: "no-cache" });
  if (!r.ok) throw new Error("designs.json missing; run node .claude/tools/build_editor_data.mjs");
  return r.json();
}

export async function loadCatalogue() {
  const [catalogue, search] = await Promise.all([
    fetch(asset("catalogue.json"), { cache: "no-cache" }).then((r) => r.json()),
    fetch(asset("search.json"), { cache: "no-cache" }).then((r) => r.json()),
  ]);
  return { catalogue, search };
}

// Icons are the biggest file and nothing needs them to draw the first frame, so they arrive
// after it and are patched into the scene when they land.
export async function loadIcons() {
  const r = await fetch(asset("icons.json"), { cache: "no-cache" });
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
