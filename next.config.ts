import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pg ships native-optional code paths; keep it out of the bundle.
  serverExternalPackages: ["pg"],
};

export default nextConfig;
