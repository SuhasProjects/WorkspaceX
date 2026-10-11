import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The monetization SDK signs requests with @aws-sdk/*, which needs Node APIs; keep it out of the bundle.
  serverExternalPackages: ["@aws-app-monetization/sdk"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
