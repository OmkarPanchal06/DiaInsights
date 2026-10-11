import type { NextConfig } from "next";

/**
 * NEXT_PUBLIC_* values are inlined into the client bundle at BUILD time, so
 * NEXT_PUBLIC_API_URL must be supplied as a Docker build arg -- changing it at runtime
 * does nothing. Note the browser resolves it, not the container: it must be a
 * publicly reachable URL, never the compose service name.
 */
const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/**
 * Content-Security-Policy.
 *
 * 'unsafe-inline' is required for script-src and style-src: the App Router inlines
 * its hydration payload as <script>, and Tailwind injects a style element. Removing it
 * needs a per-request nonce via middleware.ts -- see DEPLOY.md for that upgrade path.
 *
 * 'unsafe-eval' is NOT included; it is only ever needed by the dev server.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  // The API the browser talks to. Must match the build arg.
  `connect-src 'self' ${apiUrl}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  // Clickjacking defence. Belt-and-braces alongside X-Frame-Options below.
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
  // HSTS only matters over HTTPS, and is safe to send regardless.
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
];

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
  // Emits a self-contained server bundle in .next/standalone, which is what the
  // runtime Docker stage copies. Without this the runner stage has no server.
  output: "standalone",
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
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