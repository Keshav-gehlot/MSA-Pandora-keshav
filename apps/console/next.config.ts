import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@pandora/core", "@pandora/ui"],
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
