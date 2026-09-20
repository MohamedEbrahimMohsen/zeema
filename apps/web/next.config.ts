import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  serverExternalPackages: ["@electric-sql/pglite", "postgres", "prom-client"],
  transpilePackages: ["@zeema/core", "@zeema/catalogue"],
  // Every catalogue reference page is also readable as markdown at the same address with `.md`
  // appended. `beforeFiles` is required: the `[id]` page segment would otherwise match
  // "kafka.md" as an id and win. See app/api/reference/[type]/[id]/route.ts.
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
