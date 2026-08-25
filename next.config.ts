import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // An unrelated package.json in the user's home directory otherwise confuses
  // Turbopack's workspace-root inference. Pin it explicitly to this repo.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
