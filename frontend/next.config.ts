import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // Next 16 auto-generates a frontend/AGENTS.md on `next dev`. The repo already has a
  // single root AGENTS.md, so keep one source of truth.
  agentRules: false,
  // The dev overlay injects a floating "N" badge that would land in committed
  // screenshots.
  devIndicators: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
