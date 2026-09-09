// Static server for the Arkore canvas, with one addition: PUT under designs/ writes the file.
// That is the editor's write channel. A plain static server would leave the editor able to open
// a design and unable to save it, and a browser directory picker would tie the editor to one
// browser and add a permission prompt for something the repository already trusts this process
// to do.
//
//   node editor/serve.mjs [port]
//
// Writes are refused outside designs/, refused for anything that is not design.yaml or a
// *.layout.json sidecar, and refused for every tier but authored: the reference and imported
// designs are the repository's own, and the canvas clones one rather than overwriting it.

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.argv[2] || 8000);

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml", ".css": "text/css; charset=utf-8", ".yaml": "text/yaml; charset=utf-8",
  ".md": "text/markdown; charset=utf-8", ".png": "image/png", ".ico": "image/x-icon" };

const inside = (p) => {
  const full = path.resolve(ROOT, "." + p);
  return full.startsWith(ROOT) ? full : null;
};

// designs/authored/ is the only tier this server writes, and the only place it may create a
// folder. The reference designs are curated and the imported ones are faithful to a source
// document; neither is something an editing session should be able to overwrite by accident, so
// the canvas clones one into authored/ instead. Anything else about them stays as it was.
const TIERS = new Set(["reference", "imported", "authored"]);
const FILES = /^(design\.yaml|design\.layout\.json)$/;

const writable = (rel) => {
  const parts = rel.split("/");
  if (parts[0] !== "designs") return "writes are only allowed under designs/";
  if (parts.length !== 4) return "a design lives at designs/<tier>/<id>/<file>";
  const [, tier, id, base] = parts;
  if (!TIERS.has(tier)) return `unknown tier ${tier}`;
  if (tier !== "authored") return `${tier} designs are read only; clone one to edit it`;
  if (!FILES.test(base)) return "only design.yaml and its layout sidecar may be written";
  if (!/^[a-z][a-z0-9-]*$/.test(id)) return "a design id is kebab-case: lower case, digits, hyphens";
  const dir = path.resolve(ROOT, "designs", tier, id);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return null;
};

// The live design index. The committed editor/data/designs.json is a snapshot taken when the
// bundle was generated, so a design created since then would be invisible until someone
// regenerated it. This endpoint reads the folders instead.
const designIndex = () => {
  const out = [];
  for (const tier of ["reference", "imported", "authored"]) {
    const dir = path.join(ROOT, "designs", tier);
    if (!fs.existsSync(dir)) continue;
    for (const id of fs.readdirSync(dir).sort()) {
      if (!fs.statSync(path.join(dir, id)).isDirectory()) continue;
      for (const file of ["design.yaml", "design.broken.yaml"]) {
        const full = path.join(dir, id, file);
        if (!fs.existsSync(full)) continue;
        out.push({
          path: `designs/${tier}/${id}/${file}`,
          tier, id,
          editable: tier === "authored" && file === "design.yaml",
          layout: `designs/${tier}/${id}/${file.replace(/\.yaml$/, ".layout.json")}`,
        });
      }
    }
  }
  return out;
};

const server = http.createServer((req, res) => {
  const url = decodeURIComponent((req.url || "/").split("?")[0]);
  const full = inside(url === "/" ? "/editor/index.html" : url);
  if (!full) { res.writeHead(403).end("outside the repository"); return; }

  if (req.method === "PUT") {
    const rel = path.relative(ROOT, full).split(path.sep).join("/");
    const refusal = writable(rel);
    if (refusal) { res.writeHead(403, { "content-type": "text/plain" }).end(refusal); return; }
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      try {
        fs.writeFileSync(full, Buffer.concat(chunks));
        res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ written: rel }));
        console.log("PUT", rel, Buffer.concat(chunks).length, "bytes");
      } catch (e) { res.writeHead(500).end(String(e.message)); }
    });
    return;
  }

  if (url === "/api/designs" && (req.method === "GET" || req.method === "HEAD")) {
    const body = JSON.stringify(designIndex(), null, 2) + "\n";
    res.writeHead(200, { "content-type": "application/json", "content-length": Buffer.byteLength(body), "cache-control": "no-cache" });
    res.end(req.method === "HEAD" ? undefined : body);
    return;
  }
  if (req.method !== "GET" && req.method !== "HEAD") { res.writeHead(405).end(); return; }
  let target = full;
  if (fs.existsSync(target) && fs.statSync(target).isDirectory()) target = path.join(target, "index.html");
  // /editor/imported/chat-system is a design, not a file: the address names what to open, and
  // the editor works out the rest, so any address under /editor/ that is not a file is the page.
  if (!fs.existsSync(target) && url.startsWith("/editor/")) target = path.join(ROOT, "editor", "index.html");
  if (!fs.existsSync(target)) { res.writeHead(404, { "content-type": "text/plain" }).end("not found"); return; }
  const body = fs.readFileSync(target);
  res.writeHead(200, {
    "content-type": TYPES[path.extname(target).toLowerCase()] || "application/octet-stream",
    "content-length": body.length,
    "cache-control": "no-cache",
  });
  res.end(req.method === "HEAD" ? undefined : body);
});

// A port already in use is the most likely way this fails, and an unhandled 'error' event turns
// that into a stack trace. Say what happened and how to get past it.
server.on("error", (e) => {
  if (e.code === "EADDRINUSE") {
    console.error(`port ${PORT} is already in use. Another server is probably running; try:
  node editor/serve.mjs ${PORT + 10}`);
    process.exit(1);
  }
  throw e;
});

server.listen(PORT, () => {
  console.log(`Arkore canvas on http://localhost:${PORT}/editor/`);
  console.log(`serving ${ROOT}, PUT enabled under designs/`);
});
