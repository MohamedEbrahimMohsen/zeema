// The documented HTTP surface against the real one.
//
// `/docs/api` draws its tables from `api-routes.ts`, which is a list somebody has to keep. This
// walks `app/api`, reads the exported methods out of each handler, and fails when the two
// disagree — so a route added, removed or given another method cannot quietly leave the
// documentation behind.
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { API_ROUTES } from "./api-routes";

const API_DIR = path.join(process.cwd(), "app", "api");

/** `app/api/v1/designs/[owner]/[slug]/route.ts` -> `/api/v1/designs/{owner}/{slug}` */
const pathOf = (file: string) =>
  `/api/${path
    .relative(API_DIR, path.dirname(file))
    .split(path.sep)
    .map((s) => s.replace(/^\[(\.{3})?(.+)\]$/, "{$2}"))
    .join("/")}`;

function* handlers(dir: string): Generator<string> {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* handlers(full);
    else if (entry.name === "route.ts") yield full;
  }
}

const actual = new Set<string>();
for (const file of handlers(API_DIR)) {
  const source = fs.readFileSync(file, "utf8");
  for (const m of source.matchAll(
    /^export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/gm,
  ))
    actual.add(`${m[1]} ${pathOf(file)}`);
}

const documented = new Set(API_ROUTES.map((r) => `${r.method} ${r.path}`));

describe("the documented API", () => {
  it("found the handlers", () => {
    expect(actual.size).toBeGreaterThan(15);
  });

  it("documents every route the app serves", () => {
    expect([...actual].filter((r) => !documented.has(r)).sort()).toEqual([]);
  });

  it("documents no route the app does not serve", () => {
    expect([...documented].filter((r) => !actual.has(r)).sort()).toEqual([]);
  });

  it("says what each route needs and does", () => {
    for (const r of API_ROUTES) {
      expect(r.summary, r.path).toMatch(/\.$/);
      expect(r.path.startsWith("/api/"), r.path).toBe(true);
    }
  });
});
