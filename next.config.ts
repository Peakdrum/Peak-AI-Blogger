import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produces a self-contained `.next/standalone` server for the Docker image.
  output: "standalone",
};

export default nextConfig;
