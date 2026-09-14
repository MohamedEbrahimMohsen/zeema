import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  serverExternalPackages: ["@electric-sql/pglite", "postgres"],
  transpilePackages: ["@arkore/core", "@arkore/catalogue"],
};

export default config;
