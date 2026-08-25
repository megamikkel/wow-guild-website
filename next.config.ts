import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ["@electric-sql/pglite"],
  // Demo mode reads migration SQL from disk at runtime, so the folder must be
  // traced into the serverless bundle — nothing imports it, so tracing cannot
  // discover it on its own.
  outputFileTracingIncludes: {
    "/**": ["./drizzle/**"],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
      {
        // Member/officer areas must never be indexed.
        source: "/(dashboard|admin)/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

export default nextConfig;
