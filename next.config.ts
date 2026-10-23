import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // GitHub Pages serves plain files, so the Pages build exports static HTML (see .github/workflows/pages.yml).
  output: process.env.STATIC_EXPORT === "1" ? "export" : undefined,
};

export default nextConfig;
