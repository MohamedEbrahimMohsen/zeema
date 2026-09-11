import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["@electric-sql/pglite", "postgres"],
  transpilePackages: ["@arkore/core", "@arkore/catalogue"],
};

export default config;
