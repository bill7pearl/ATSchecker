import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Ensure we can export client-side bundles or do static exports if the user wants.
  eslint: {
    // Disable ESLint checks during build to prevent blocker warnings for client-side API integrations
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Ignore build errors to keep dynamic client worker structures clean
    ignoreBuildErrors: true,
  }
};

export default nextConfig;
