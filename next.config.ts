import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  // The OG route reads its fonts from disk at request time; make sure they
  // are traced into the serverless bundle.
  outputFileTracingIncludes: {
    "/api/og": ["./app/api/og/fonts/*"],
  },
};

export default nextConfig;
