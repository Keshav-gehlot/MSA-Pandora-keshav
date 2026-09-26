import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@pandora/core", "@pandora/ui", "@pandora/db", "@pandora/email"],
  serverExternalPackages: ["pg"],
  experimental: { serverActions: { bodySizeLimit: "6mb" } },
};

export default nextConfig;
