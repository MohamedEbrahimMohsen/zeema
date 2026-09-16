// Prometheus metrics for the web app.
//
// Two sources feed the registry. HTTP timings come from Node's own diagnostics channels, so
// every request the server answers is measured, pages included, without wrapping a handler or
// running a custom server. Domain counters are incremented by the service layer, and the
// table counts are read from the database when Prometheus scrapes.
//
// The registry lives on globalThis because Next bundles instrumentation.ts separately from the
// route handlers: without this, the subscriber and the endpoint would hold different instances.
import { subscribe } from "node:diagnostics_channel";
import {
  Counter,
  collectDefaultMetrics,
  register as defaultRegister,
  Gauge,
  Histogram,
  type Registry,
} from "prom-client";

type Metrics = {
  registry: Registry;
  httpDuration: Histogram<"route" | "method" | "status">;
  inFlight: Gauge<string>;
  saves: Counter<"kind">;
  exports: Counter<"format">;
  signins: Counter<"result">;
};

const g = globalThis as unknown as { __arkoreMetrics?: Metrics };

/**
 * Path to a low-cardinality label. Every dynamic segment becomes a placeholder, so a million
 * design pages stay one time series instead of a million.
 */
export function routeOf(rawPath: string): string {
  const path = rawPath.split("?")[0].replace(/\/+$/, "") || "/";
  if (path.startsWith("/_next/static")) return "/_next/static";
  if (path.startsWith("/_next")) return "/_next";
  const s = path.split("/").filter(Boolean);
  if (!s.length) return "/";
  if (s[0] === "api") {
    if (s[1] === "auth") return `/api/auth/${s[2] ?? ""}`.replace(/\/$/, "");
    if (s[1] === "health" || s[1] === "metrics") return `/api/${s[1]}`;
    if (s[1] === "v1") {
      if (s[2] === "designs" && s.length >= 5)
        return `/api/v1/designs/:owner/:slug${s[5] ? `/${s[5]}` : ""}`;
      if (s[2] === "users") return "/api/v1/users/:username";
      if (s[2] === "admin") return `/api/v1/admin/${s[3] ?? ""}`.replace(/\/$/, "");
      return `/api/v1/${s.slice(2).join("/")}`;
    }
    return "/api";
  }
  if (s[0] === "d") return `/d/:owner/:slug${s[3] ? `/${s[3]}` : ""}`;
  if (s[0] === "u") return "/u/:username";
  if (s[0] === "catalogue") {
    if (s[1] === "components") return "/catalogue/components/:id";
    if (s[1] === "kinds") return "/catalogue/kinds/:id";
    return path;
  }
  if (["browse", "docs", "signin", "new", "admin"].includes(s[0])) return path;
  return "other";
}

function build(): Metrics {
  const registry = defaultRegister;
  registry.setDefaultLabels({ app: "arkore-web" });
  collectDefaultMetrics({ register: registry });

  const httpDuration = new Histogram({
    name: "arkore_http_request_duration_seconds",
    help: "Time from the first byte of a request to the end of its response",
    labelNames: ["route", "method", "status"] as const,
    buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    registers: [registry],
  });
  const inFlight = new Gauge({
    name: "arkore_http_requests_in_flight",
    help: "Requests being answered right now",
    registers: [registry],
  });
  const saves = new Counter({
    name: "arkore_design_writes_total",
    help: "Design writes by kind: save, publish, clone, create, delete",
    labelNames: ["kind"] as const,
    registers: [registry],
  });
  const exports_ = new Counter({
    name: "arkore_design_exports_total",
    help: "Design exports by format",
    labelNames: ["format"] as const,
    registers: [registry],
  });
  const signins = new Counter({
    name: "arkore_signins_total",
    help: "Sign-in attempts by result",
    labelNames: ["result"] as const,
    registers: [registry],
  });

  // Table counts, read at scrape time and cached briefly so a tight scrape interval cannot
  // turn monitoring into load.
  let cache: { at: number; rows: Record<string, number> } = { at: 0, rows: {} };
  const counts = async () => {
    if (Date.now() - cache.at < 30_000) return cache.rows;
    const { getDb } = await import("@/db");
    const db = await getDb();
    const q = async (sql: string) => {
      const res = (await db.execute(sql)) as unknown as
        | { rows?: { n: unknown }[] }
        | { n: unknown }[];
      const rows = Array.isArray(res) ? res : (res.rows ?? []);
      return Number(rows[0]?.n ?? 0);
    };
    cache = {
      at: Date.now(),
      rows: {
        users: await q("select count(*)::int as n from users where deleted_at is null"),
        designs_public: await q(
          "select count(*)::int as n from designs where deleted_at is null and visibility = 'public'",
        ),
        designs_private: await q(
          "select count(*)::int as n from designs where deleted_at is null and visibility = 'private'",
        ),
        designs_unpublished: await q(
          "select count(*)::int as n from designs where deleted_at is null and current_version_id is distinct from published_version_id",
        ),
        versions: await q("select count(*)::int as n from design_versions"),
        sessions_active: await q(
          "select count(*)::int as n from sessions where revoked = false and expires_at > now()",
        ),
      },
    };
    return cache.rows;
  };

  new Gauge({
    name: "arkore_users_total",
    help: "Accounts that are not deleted",
    registers: [registry],
    async collect() {
      this.set((await counts()).users ?? 0);
    },
  });
  new Gauge({
    name: "arkore_designs_total",
    help: "Designs that are not deleted, by visibility",
    labelNames: ["visibility"] as const,
    registers: [registry],
    async collect() {
      const c = await counts();
      this.set({ visibility: "public" }, c.designs_public ?? 0);
      this.set({ visibility: "private" }, c.designs_private ?? 0);
    },
  });
  new Gauge({
    name: "arkore_designs_unpublished",
    help: "Designs whose head is ahead of their release",
    registers: [registry],
    async collect() {
      this.set((await counts()).designs_unpublished ?? 0);
    },
  });
  new Gauge({
    name: "arkore_design_versions_total",
    help: "Stored design versions",
    registers: [registry],
    async collect() {
      this.set((await counts()).versions ?? 0);
    },
  });
  new Gauge({
    name: "arkore_sessions_active",
    help: "Sessions that are neither revoked nor expired",
    registers: [registry],
    async collect() {
      this.set((await counts()).sessions_active ?? 0);
    },
  });

  return { registry, httpDuration, inFlight, saves, exports: exports_, signins };
}

export function metrics(): Metrics {
  if (!g.__arkoreMetrics) g.__arkoreMetrics = build();
  return g.__arkoreMetrics;
}

type Timed = { __arkoreStart?: bigint };

/**
 * Subscribe to Node's HTTP channels once. Every response the server finishes lands in the
 * histogram, so page renders are measured as accurately as API calls.
 */
export function installHttpMetrics() {
  const m = metrics();
  const started = globalThis as unknown as { __arkoreHttpMetrics?: boolean };
  if (started.__arkoreHttpMetrics) return;
  started.__arkoreHttpMetrics = true;
  subscribe("http.server.request.start", (message) => {
    const { request } = message as { request: Timed };
    request.__arkoreStart = process.hrtime.bigint();
    m.inFlight.inc();
  });
  subscribe("http.server.response.finish", (message) => {
    const { request, response } = message as {
      request: Timed & { url?: string; method?: string };
      response: { statusCode?: number };
    };
    m.inFlight.dec();
    const start = request.__arkoreStart;
    if (!start) return;
    const seconds = Number(process.hrtime.bigint() - start) / 1e9;
    m.httpDuration.observe(
      {
        route: routeOf(request.url ?? "/"),
        method: request.method ?? "GET",
        status: String(response.statusCode ?? 0),
      },
      seconds,
    );
  });
}

/** Domain counters. Called from the service layer; never throws into a request path. */
export const countWrite = (kind: "save" | "publish" | "clone" | "create" | "delete") => {
  try {
    metrics().saves.inc({ kind });
  } catch {}
};
export const countExport = (format: string) => {
  try {
    metrics().exports.inc({ format });
  } catch {}
};
export const countSignin = (result: "ok" | "failed") => {
  try {
    metrics().signins.inc({ result });
  } catch {}
};
