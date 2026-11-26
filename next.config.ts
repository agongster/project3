import type { NextConfig } from "next";

// GitHub Pages can only serve plain files from a sub-folder, so that build
// exports static HTML (see src/lib/hosting.ts and .github/workflows/pages.yml).
const staticHost = process.env.NEXT_PUBLIC_STATIC_HOST === "1";

const nextConfig: NextConfig = {
  ...(staticHost ? { output: "export" as const, basePath: process.env.NEXT_PUBLIC_BASE_PATH ?? "", trailingSlash: true } : {}),
  turbopack: {
    rules: {
      // Tailwind CSS v4 runs as a Turbopack loader.
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
