// The page policy and the write check in proxy.ts, exercised as the server runs them.
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { contentSecurityPolicy, proxy } from "../../proxy";

describe("content security policy", () => {
  it("never lets an inline script run without the nonce", () => {
    const csp = contentSecurityPolicy("abc", false);
    const script = csp.split("; ").find((d) => d.startsWith("script-src"))!;
    expect(script).toContain("'nonce-abc'");
    expect(script).not.toContain("unsafe-inline");
    expect(script).not.toContain("unsafe-eval");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
  });

  it("allows eval only in development", () => {
    expect(contentSecurityPolicy("abc", true)).toContain("'unsafe-eval'");
  });

  it("gives every page response a fresh nonce", () => {
    const a = proxy(new NextRequest("http://localhost:3000/browse"));
    const b = proxy(new NextRequest("http://localhost:3000/browse"));
    const csp = a.headers.get("content-security-policy") ?? "";
    expect(csp).toMatch(/'nonce-[A-Za-z0-9+/=]+'/);
    expect(csp).not.toBe(b.headers.get("content-security-policy"));
  });
});

describe("cross-site writes", () => {
  const post = (headers: Record<string, string>) =>
    proxy(new NextRequest("http://localhost:3000/api/v1/designs", { method: "POST", headers }));

  it("refuses a write from another origin with 403", async () => {
    const res = post({ origin: "https://evil.example" });
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe(403);
  });

  it("lets a same-origin write through to the route", () => {
    expect(post({ origin: "http://localhost:3000" }).status).toBe(200);
  });

  it("does not touch reads", () => {
    const res = proxy(
      new NextRequest("http://localhost:3000/api/v1/designs", {
        headers: { origin: "https://evil.example" },
      }),
    );
    expect(res.status).toBe(200);
  });
});

describe("the addressed host counts as our origin", () => {
  it("accepts a write whose Origin matches the Host it was sent to", () => {
    const res = proxy(
      new NextRequest("http://localhost:3000/api/v1/lint", {
        method: "POST",
        headers: { origin: "http://127.0.0.1:3000", host: "127.0.0.1:3000" },
      }),
    );
    expect(res.status).toBe(200);
  });

  it("still refuses a foreign Origin sent to that host", () => {
    const res = proxy(
      new NextRequest("http://localhost:3000/api/v1/lint", {
        method: "POST",
        headers: { origin: "http://evil.example", host: "127.0.0.1:3000" },
      }),
    );
    expect(res.status).toBe(403);
  });
});
