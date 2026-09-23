import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  // No framework banner in every response.
  poweredByHeader: false,
  devIndicators: false,
  serverExternalPackages: ["@electric-sql/pglite", "postgres", "prom-client"],
  transpilePackages: ["@zeema/core", "@zeema/catalogue"],
  // Every catalogue reference page is also readable as markdown at the same address with `.md`
  // appended. `beforeFiles` is required: the `[id]` page segment would otherwise match
  // "kafka.md" as an id and win. See app/api/reference/[type]/[id]/route.ts.
  // Security headers for every response, static files included. The Content-Security-Policy is
  // per request (it carries a nonce), so proxy.ts sets it, together with HSTS when APP_ORIGIN
  // is https. docs/deploy.md lists the same set for a reverse proxy.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
          },
        ],
      },
    ];
  },
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/catalogue/:type(components|kinds|rules)/:id.md",
          destination: "/api/reference/:type/:id",
        },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default config;
