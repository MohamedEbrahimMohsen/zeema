// Static server for the Arkore canvas, with one addition: PUT under designs/ writes the file.
// That is the editor's write channel. A plain static server would leave the editor able to open
// a design and unable to save it, and a browser directory picker would tie the editor to one
// browser and add a permission prompt for something the repository already trusts this process
// to do.
//
//   node editor/serve.mjs [port]
//
// Writes are refused outside designs/, refused for anything that is not design.yaml,
// design.broken.yaml or a *.layout.json sidecar, and refused for the seven broken variants,
// which must keep tripping exactly the rules their headers name.

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

const writable = (rel) => {
  if (!rel.startsWith("designs/")) return "writes are only allowed under designs/";
  const base = path.basename(rel);
  if (base === "design.broken.yaml") return "the broken reference variants are read only";
  if (!/^(design\.yaml|design\.layout\.json|design\.broken\.layout\.json)$/.test(base))
    return "only design.yaml and its layout sidecar may be written";
  if (!fs.existsSync(path.dirname(path.resolve(ROOT, rel)))) return "no such design folder";
  return null;
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

  if (req.method !== "GET" && req.method !== "HEAD") { res.writeHead(405).end(); return; }
  let target = full;
  if (fs.existsSync(target) && fs.statSync(target).isDirectory()) target = path.join(target, "index.html");
  if (!fs.existsSync(target)) { res.writeHead(404, { "content-type": "text/plain" }).end("not found"); return; }
  const body = fs.readFileSync(target);
  res.writeHead(200, {
    "content-type": TYPES[path.extname(target).toLowerCase()] || "application/octet-stream",
    "content-length": body.length,
    "cache-control": "no-cache",
  });
  res.end(req.method === "HEAD" ? undefined : body);
});

server.listen(PORT, () => {
  console.log(`Arkore canvas on http://localhost:${PORT}/editor/`);
  console.log(`serving ${ROOT}, PUT enabled under designs/`);
});
