import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prevent a parent lockfile from becoming the Turbopack workspace root.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
