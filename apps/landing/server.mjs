// The marketing landing page, served on its own port so it can scale and cache
// separately from the app. It is one static HTML file. Two things in it depend on the
// running canvas app, so they are filled in here rather than hard-coded:
//
//   - every link into the app. Its origin differs per environment — http://localhost:3000 in
//     development, https://zeema.dev in production — so CANVAS_URL replaces the
//     __CANVAS_URL__ placeholder at startup.
//   - the live numbers: the catalogue counts and, for each design card, its component, edge
//     and finding counts and its corner brand badge. They are fetched from the app at startup
//     and every ten minutes after.
//     The catalogue counts in the page are a fallback; a design card whose numbers could not
//     be fetched shows none, never made-up ones.
//
// No dependencies: Node's own http and fetch.

import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.LANDING_PORT ?? 4000);
const host = process.env.LANDING_BIND ?? "0.0.0.0";
const canvasUrl = (process.env.CANVAS_URL ?? "http://localhost:3000").replace(/\/+$/, "");
// Where this server itself reaches the app's API. The same as CANVAS_URL unless the app is
// reachable from here under another address (a compose service name, say).
const apiUrl = (process.env.CANVAS_API_URL ?? canvasUrl).replace(/\/+$/, "");
const REFRESH_MS = 10 * 60 * 1000;
const RETRY_MS = [5_000, 15_000, 30_000, 60_000];

const template = readFileSync(join(here, "public", "index.html"), "utf8").replaceAll(
  "__CANVAS_URL__",
  canvasUrl,
);

let live = { catalogue: null, designs: new Map() };

const int = (v) => (Number.isInteger(v) && v >= 0 ? v : null);
const fmt = (n) => n.toLocaleString("en-US");
const plural = (n, word) => `${fmt(n)} ${word}${n === 1 ? "" : "s"}`;

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

// The badge markup comes from the app, which already strips scripts and handlers (brand.ts).
// This is a second line, never the first: markup with anything that could run is refused whole.
const UNSAFE = /<script|\bon[a-z]+\s*=|javascript:|<foreignObject/i;

/** A card's corner brand badge, drawn as the browse row draws it, or "" when there is none. */
export function badgeHtml(badge) {
  if (!badge || typeof badge.name !== "string" || typeof badge.markup !== "string") return "";
  if (!badge.markup.trim() || UNSAFE.test(badge.markup)) return "";
  return `<span class="dz-badge" title="${esc(badge.name)}" aria-hidden="true"><svg viewBox="0 0 24 24">${badge.markup}</svg></span>`;
}

/** The page with whatever live numbers are known. Pure: template and data in, HTML out. */
export function render(html, { catalogue, designs }) {
  let out = html;
  if (catalogue) {
    out = out.replace(
      /(<(b|span) data-stat="(components|kinds|rules|providers)">)[^<]*(<\/\2>)/g,
      (m, open, _tag, key, close) =>
        int(catalogue[key]) === null ? m : `${open}${fmt(catalogue[key])}${close}`,
    );
  }
  // The badge sits over the drawing; the thumbnail's alt names it, as the browse row's does.
  out = out.replace(
    /(<span class="dz-thumb" data-badge="([a-z0-9-]+)">)([\s\S]*?)(<\/span>)/g,
    (m, open, slug, inner, close) => {
      const badge = designs.get(slug)?.badge;
      const chip = badgeHtml(badge);
      if (!chip) return m;
      const named = inner.replace(/ alt="([^"]*)"/, (a, text) =>
        text.toLowerCase().includes(badge.name.toLowerCase())
          ? a
          : ` alt="${text}, ${esc(badge.name)}"`,
      );
      return `${open}${named}${chip}${close}`;
    },
  );
  out = out.replace(/<span class="dz-meta" data-counts="([a-z0-9-]+)"><\/span>/g, (m, slug) => {
    const d = designs.get(slug);
    if (!d || [d.nodeCount, d.edgeCount, d.findingCount].some((n) => int(n) === null)) return m;
    const found =
      d.findingCount === 0
        ? `<span class="dz-ok">✓ 0 findings</span>`
        : `<span class="dz-warn">⚠ ${plural(d.findingCount, "finding")}</span>`;
    return `<span class="dz-meta" data-counts="${slug}">${plural(d.nodeCount, "component")} · ${plural(d.edgeCount, "edge")} · ${found}</span>`;
  });
  return out;
}

async function getJson(path, timeoutMs) {
  const res = await fetch(`${apiUrl}${path}`, {
    signal: AbortSignal.timeout(timeoutMs),
    headers: { accept: "application/json" },
  });
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.json();
}

// The catalogue bundle (/api/v1/catalogue redirects to it) carries every kind, component and
// rule; the counts are its sizes.
async function fetchCatalogue() {
  const c = await getJson("/api/v1/catalogue", 20_000);
  const components = Object.values(c.components ?? {});
  return {
    components: components.length,
    kinds: Object.keys(c.kinds ?? {}).length,
    rules: (c.rules ?? []).length,
    providers: new Set(components.map((x) => x.provider)).size,
  };
}

// The public design list, the same one the browse page reads. Curated designs have no owner
// and live under `zeema/`.
async function fetchDesigns(slugs) {
  const found = new Map();
  for (let page = 1; page <= 20 && found.size < slugs.size; page++) {
    const r = await getJson(`/api/v1/designs?pageSize=100&page=${page}`, 8_000);
    for (const d of r.items ?? []) {
      const owner = d.owner?.username ?? "zeema";
      const counts = {
        nodeCount: int(d.nodeCount),
        edgeCount: int(d.edgeCount),
        findingCount: int(d.findingCount),
      };
      // A card shows its numbers only when all three are sound (checked at render), and its
      // badge whenever the app has one.
      if (owner === "zeema" && slugs.has(d.slug)) found.set(d.slug, { ...counts, badge: d.badge });
    }
    if (!r.items?.length || page * (r.pageSize ?? 100) >= (r.total ?? 0)) break;
  }
  return found;
}

const slugs = new Set([...template.matchAll(/data-counts="([a-z0-9-]+)"/g)].map((m) => m[1]));
let body = Buffer.from(render(template, live));

async function refresh() {
  const [catalogue, designs] = await Promise.allSettled([fetchCatalogue(), fetchDesigns(slugs)]);
  const problems = [catalogue, designs].filter((r) => r.status === "rejected");
  // A failed half keeps what the last good fetch found.
  live = {
    catalogue: catalogue.status === "fulfilled" ? catalogue.value : live.catalogue,
    designs: designs.status === "fulfilled" ? designs.value : live.designs,
  };
  body = Buffer.from(render(template, live));
  if (problems.length) throw new Error(problems.map((p) => p.reason?.message).join("; "));
}

async function refreshWithRetry(attempt = 0) {
  try {
    await refresh();
    console.log(
      `landing: live numbers from ${apiUrl} (${live.designs.size}/${slugs.size} designs)`,
    );
  } catch (e) {
    const wait = RETRY_MS[attempt];
    console.warn(
      `landing: could not fetch live numbers (${e.message})${wait ? `; retrying in ${wait / 1000}s` : ""}`,
    );
    if (wait) setTimeout(() => refreshWithRetry(attempt + 1), wait).unref();
  }
}

const server = createServer((req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { allow: "GET, HEAD" }).end();
    return;
  }
  // A liveness endpoint for the container healthcheck.
  if (req.url === "/health") {
    res.writeHead(200, { "content-type": "text/plain" }).end("ok");
    return;
  }
  // A single-page site: every path serves the landing page.
  res.writeHead(200, {
    "content-type": "text/html; charset=utf-8",
    "content-length": body.length,
    "cache-control": "public, max-age=60",
  });
  res.end(req.method === "HEAD" ? undefined : body);
});

// Imported by the test for `render`; only a direct run serves.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  server.listen(port, host, () => {
    console.log(`landing on http://${host}:${port}  ->  canvas at ${canvasUrl}`);
  });
  refreshWithRetry();
  setInterval(() => refreshWithRetry(), REFRESH_MS).unref();
}
