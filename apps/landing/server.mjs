// The marketing landing page, served on its own port so it can scale and cache
// separately from the app. It is one static HTML file; the only dynamic part is the
// destination of the "Open Canvas" / "Get started" buttons, which point at the running
// canvas app. That URL differs per environment — http://localhost:3000 in development,
// a subdomain such as https://canvas.zeema.io in production — so it is injected from
// CANVAS_URL at startup rather than hard-coded into the page.

import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.LANDING_PORT ?? 4000);
const host = process.env.LANDING_BIND ?? "0.0.0.0";
const canvasUrl = process.env.CANVAS_URL ?? "http://localhost:3000";

// Read and template the page once. It is small and unchanging, so there is no reason to
// touch disk per request.
const html = readFileSync(join(here, "public", "index.html"), "utf8").replaceAll(
  "__CANVAS_URL__",
  canvasUrl,
);
const body = Buffer.from(html);

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

server.listen(port, host, () => {
  console.log(`landing on http://${host}:${port}  ->  canvas at ${canvasUrl}`);
});
