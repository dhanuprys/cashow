import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output for the Docker deployment (section 7). The tracing root
  // points at the monorepo root so workspace packages are traced correctly.
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, "../.."),
  experimental: {
    agentFeedback: true,
    validateRSCRequestHeaders: false,
    serverActions: {
      allowedOrigins: ["dev.cashow.my.id", "192.168.32.2:3000", "192.168.32.2"],
    },
  },
  allowedDevOrigins: ["dev.cashow.my.id", "192.168.32.2"],
  cacheComponents: true,
  partialPrefetching: true,
  async headers() {
    // `unsafe-eval` is only needed by the dev server's HMR runtime. Production
    // bundles do not evaluate strings, so leaving it on widened the XSS blast
    // radius for no benefit. Cloudflare Insights beacon is allowed for sites proxied via CF.
    const scriptSrc =
      process.env.NODE_ENV === "production"
        ? "script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com"
        : "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://static.cloudflareinsights.com";
    const csp = [
      "default-src 'self'",
      scriptSrc,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self' ws: wss: https://cloudflareinsights.com",
      "worker-src 'self' blob:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join("; ");

    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: `${csp};` },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
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
