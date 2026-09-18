import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  serverExternalPackages: ["@electric-sql/pglite", "postgres", "prom-client"],
  transpilePackages: ["@zeema/core", "@zeema/catalogue"],
};

export default config;
