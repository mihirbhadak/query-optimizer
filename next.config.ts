import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // better-sqlite3 is a native addon (.node binary). Keep it out of the bundle so
  // it's loaded from node_modules at runtime in Server Components / Route Handlers.
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
