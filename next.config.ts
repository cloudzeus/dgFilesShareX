import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    // Allow large file uploads up to 1GB (e.g. /api/files/upload).
    proxyClientMaxBodySize: "1gb",
  },
};

export default nextConfig;
