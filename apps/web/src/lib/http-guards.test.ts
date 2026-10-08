// The request guards from the security review: redirects, client addresses, cross-site writes,
// pagination, LIKE escaping, download names and the bounded limiter map.
import { describe, expect, it } from "vitest";
import { bootProblems, databaseConfigured, eventSalt } from "./boot";
import {
  appOrigin,
  attachment,
  clientIp,
  crossSiteRefusal,
  escapeLike,
  intParam,
  LruTtl,
  pagination,
  redirectTo,
  safeNext,
} from "./http-guards";

const ORIGIN = "https://zeema.example";
const h = (o: Record<string, string>) => new Headers(o);

describe("safeNext", () => {
  it.each([
    ["/ok?x=1", "/ok?x=1"],
    ["/d/zeema/youtube#top", "/d/zeema/youtube#top"],
    ["/", "/"],
    ["/signin?next=%2Fnew", "/signin?next=%2Fnew"],
  ])("keeps the path %s", (raw, want) => {
    expect(safeNext(raw, ORIGIN)).toBe(want);
  });

  it.each([
    "//evil.example",
    "//evil.example/signin",
    "/\\evil.example",
    "/\\/evil.example",
    "https://evil.example",
    "http:evil.example",
    "javascript:alert(1)",
    "evil.example",
    "",
    "/ok\r\nSet-Cookie: x=1",
    "/tab\there",
    "/a\\b",
    "//evil.example\\@zeema.example",
    "/..//evil.example",
    "/./..//evil.example/x",
  ])("refuses %j", (raw) => {
    expect(safeNext(raw, ORIGIN)).toBe("/");
  });

  it("refuses what is not a string and absurdly long input", () => {
    expect(safeNext(undefined, ORIGIN)).toBe("/");
    expect(safeNext(["/x"], ORIGIN)).toBe("/");
    expect(safeNext(`/${"a".repeat(5000)}`, ORIGIN)).toBe("/");
  });

  it("never returns anything but a path on the origin", () => {
    for (const raw of ["/%2F%2Fevil.example", "/./evil", "/..//evil.example"]) {
      const out = safeNext(raw, ORIGIN);
      expect(out.startsWith("/")).toBe(true);
      expect(new URL(out, ORIGIN).origin).toBe(ORIGIN);
    }
  });
});

describe("clientIp", () => {
  it("ignores X-Forwarded-For without a trusted proxy", () => {
    expect(clientIp(h({ "x-forwarded-for": "1.2.3.4" }), {})).toBe("anon");
    expect(clientIp(h({ "x-real-ip": "1.2.3.4" }), { TRUSTED_PROXY: "0" })).toBe("anon");
  });

  it("takes the rightmost entry behind one trusted proxy", () => {
    const env = { TRUSTED_PROXY: "1" };
    expect(clientIp(h({ "x-forwarded-for": "6.6.6.6, 203.0.113.9" }), env)).toBe("203.0.113.9");
    expect(clientIp(h({ "x-forwarded-for": "203.0.113.9" }), env)).toBe("203.0.113.9");
  });

  it("skips one entry per trusted hop", () => {
    const env = { TRUSTED_PROXY: "2" };
    expect(clientIp(h({ "x-forwarded-for": "6.6.6.6, 203.0.113.9, 10.0.0.2" }), env)).toBe(
      "203.0.113.9",
    );
  });

  it("cannot be steered by prepending entries", () => {
    const env = { TRUSTED_PROXY: "1" };
    const a = clientIp(h({ "x-forwarded-for": "1.1.1.1, 198.51.100.7" }), env);
    const b = clientIp(h({ "x-forwarded-for": "2.2.2.2, 3.3.3.3, 198.51.100.7" }), env);
    expect(a).toBe(b);
  });

  it("falls back to X-Real-IP from the proxy, and refuses garbage", () => {
    const env = { TRUSTED_PROXY: "1" };
    expect(clientIp(h({ "x-real-ip": "2001:DB8::1" }), env)).toBe("2001:db8::1");
    expect(clientIp(h({ "x-forwarded-for": "<script>" }), env)).toBe("anon");
    expect(clientIp(h({}), env)).toBe("anon");
  });
});

describe("crossSiteRefusal", () => {
  const allowed = [ORIGIN, "http://127.0.0.1:3000"];

  it("lets reads through whatever their origin", () => {
    for (const m of ["GET", "HEAD", "OPTIONS"])
      expect(crossSiteRefusal(m, h({ origin: "https://evil.example" }), allowed)).toBeNull();
  });

  it("accepts writes from our own origin", () => {
    for (const m of ["POST", "PUT", "PATCH", "DELETE"])
      expect(crossSiteRefusal(m, h({ origin: ORIGIN }), allowed)).toBeNull();
  });

  it("refuses writes from any other origin, and from an opaque one", () => {
    expect(crossSiteRefusal("POST", h({ origin: "https://evil.example" }), allowed)).toMatch(
      /cross-origin/,
    );
    expect(crossSiteRefusal("DELETE", h({ origin: "null" }), allowed)).toMatch(/cross-origin/);
    expect(crossSiteRefusal("POST", h({ origin: "https://zeema.example.evil" }), allowed)).toMatch(
      /cross-origin/,
    );
  });

  it("without Origin, refuses only what the browser marks cross-site", () => {
    expect(crossSiteRefusal("POST", h({ "sec-fetch-site": "cross-site" }), allowed)).toMatch(
      /cross-site/,
    );
    expect(crossSiteRefusal("POST", h({ "sec-fetch-site": "same-origin" }), allowed)).toBeNull();
    expect(crossSiteRefusal("POST", h({}), allowed)).toBeNull();
  });
});

describe("pagination", () => {
  const q = (s: string) => new URLSearchParams(s);
  it("defaults on anything unreadable", () => {
    expect(pagination(q(""))).toEqual({ page: 1, pageSize: 24 });
    expect(pagination(q("page=abc&pageSize=NaN"))).toEqual({ page: 1, pageSize: 24 });
    expect(pagination(q("page=1.5&pageSize=1e3"))).toEqual({ page: 1, pageSize: 24 });
    expect(pagination(q("page=&pageSize=%20"))).toEqual({ page: 1, pageSize: 24 });
  });
  it("clamps to the bounds", () => {
    expect(pagination(q("page=0&pageSize=0"))).toEqual({ page: 1, pageSize: 1 });
    expect(pagination(q("page=-3&pageSize=9999"))).toEqual({ page: 1, pageSize: 100 });
    expect(pagination(q("page=7&pageSize=50"))).toEqual({ page: 7, pageSize: 50 });
    expect(pagination(q("page=99999999999999999999"))).toEqual({ page: 10_000, pageSize: 24 });
  });
  it("intParam reads integers only", () => {
    expect(intParam("12", { fallback: 1, min: 1, max: 100 })).toBe(12);
    expect(intParam("12px", { fallback: 1, min: 1, max: 100 })).toBe(1);
    expect(intParam(null, { fallback: 5, min: 1, max: 100 })).toBe(5);
  });
});

describe("escapeLike", () => {
  it("escapes the three LIKE metacharacters and nothing else", () => {
    expect(escapeLike("100%_done\\")).toBe("100\\%\\_done\\\\");
    expect(escapeLike("%_%_%_")).toBe("\\%\\_\\%\\_\\%\\_");
    expect(escapeLike("plain words")).toBe("plain words");
  });
});

describe("attachment", () => {
  it("names the file safely in both forms", () => {
    expect(attachment("youtube", "yaml")).toBe(
      "attachment; filename=\"youtube.yaml\"; filename*=UTF-8''youtube.yaml",
    );
    const evil = attachment('x"; filename="setup.bat', "yaml");
    expect(evil).toMatch(/^attachment; filename="[A-Za-z0-9._-]+"; filename\*=UTF-8''[^"';\s]+$/);
    expect(attachment("café (1)", "svg")).toContain("filename*=UTF-8''caf%C3%A9%20%281%29.svg");
  });
});

describe("LruTtl", () => {
  it("evicts the least recently used entry when full", () => {
    const m = new LruTtl<number>(2, 1000);
    m.set("a", 1);
    m.set("b", 2);
    m.get("a");
    m.set("c", 3);
    expect(m.has("a")).toBe(true);
    expect(m.has("b")).toBe(false);
    expect(m.has("c")).toBe(true);
    expect(m.size).toBe(2);
  });

  it("forgets entries after their time to live", () => {
    let now = 0;
    const m = new LruTtl<number>(10, 100, () => now);
    m.set("a", 1);
    now = 50;
    expect(m.get("a")).toBe(1);
    now = 151;
    expect(m.get("a")).toBeUndefined();
  });

  it("a flood of fresh keys never clears the recent ones wholesale", () => {
    const m = new LruTtl<number>(1000, 60_000);
    m.set("victim", 1);
    for (let i = 0; i < 998; i++) m.set(`k${i}`, i);
    m.get("victim");
    for (let i = 0; i < 500; i++) m.set(`j${i}`, i);
    expect(m.has("victim")).toBe(true);
    expect(m.size).toBe(1000);
  });
});

describe("boot checks", () => {
  it("refuses production without a database or a real salt", () => {
    const p = bootProblems({ NODE_ENV: "production", EVENT_SALT: "zeema" });
    expect(p.join(" ")).toMatch(/DATABASE_URL/);
    expect(p.join(" ")).toMatch(/EVENT_SALT/);
    expect(
      bootProblems({
        NODE_ENV: "production",
        DATABASE_URL: "postgres://x",
        EVENT_SALT: "s3cr3t-salt",
      }),
    ).toEqual([]);
  });

  it("leaves development alone", () => {
    expect(bootProblems({ NODE_ENV: "development" })).toEqual([]);
    expect(databaseConfigured({ NODE_ENV: "development" })).toBe(true);
    expect(eventSalt({ NODE_ENV: "test" })).toBe("zeema-dev");
  });

  it("reports an unconfigured database in production", () => {
    expect(databaseConfigured({ NODE_ENV: "production" })).toBe(false);
    expect(() => eventSalt({ NODE_ENV: "production", EVENT_SALT: "change-me" })).toThrow(
      /EVENT_SALT/,
    );
  });
});

describe("redirectTo", () => {
  const inner = { url: "https://localhost:3000/api/auth/github/callback?code=x" };
  const proxied = { CANVAS_URL: "https://canvas.example/" };

  it("resolves against CANVAS_URL when it is set, not the internal request address", () => {
    expect(redirectTo(inner, "/u/alice", proxied).href).toBe("https://canvas.example/u/alice");
    expect(redirectTo(inner, "/signin?error=state-mismatch", proxied).href).toBe(
      "https://canvas.example/signin?error=state-mismatch",
    );
  });

  it("falls back to the request's own origin without CANVAS_URL", () => {
    expect(redirectTo(inner, "/u/alice", {}).href).toBe("https://localhost:3000/u/alice");
    expect(redirectTo(inner, "/", { CANVAS_URL: "not a url" }).href).toBe(
      "https://localhost:3000/",
    );
  });

  it.each([
    "//evil.example/x",
    "/\\evil.example",
    "https://evil.example/",
    "javascript:alert(1)",
    "/..//evil.example",
  ])("refuses %s and lands on the site root", (next) => {
    expect(redirectTo(inner, next, proxied).href).toBe("https://canvas.example/");
    expect(redirectTo(inner, next, {}).href).toBe("https://localhost:3000/");
  });
});

describe("appOrigin", () => {
  it("reads CANVAS_URL, normalised to an origin", () => {
    expect(appOrigin({ CANVAS_URL: "https://canvas.example/some/path/" })).toBe(
      "https://canvas.example",
    );
  });

  it("is null when CANVAS_URL is unset or unparseable", () => {
    expect(appOrigin({})).toBeNull();
    expect(appOrigin({ CANVAS_URL: "not a url" })).toBeNull();
  });
});
