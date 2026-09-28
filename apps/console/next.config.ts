import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@pandora/core", "@pandora/ui", "@pandora/db", "@pandora/email"],
  // pg's Cloudflare socket support lives behind a conditional require() that Next's file tracer doesn't follow,
  // so it never copies pg-cloudflare into the bundle. Marking pg external instead copies the whole real package
  // (and its dependencies) verbatim rather than tracing individual files.
  serverExternalPackages: ["pg"],
  // pg's require("pg-cloudflare") above is also invisible to Next's tracer (it's what decides which node_modules
  // files get copied into the Cloudflare Worker bundle), so it never gets copied even though it's installed.
  // This explicitly forces those files to be included. See:
  // https://github.com/opennextjs/opennextjs-cloudflare/issues/1214
  outputFileTracingIncludes: {
    "/**": ["../../node_modules/.pnpm/pg-cloudflare@*/node_modules/pg-cloudflare/dist/**"],
  },
  experimental: { serverActions: { bodySizeLimit: "6mb" } },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

export default nextConfig;

import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
