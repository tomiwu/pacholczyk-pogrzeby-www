import type { NextConfig } from "next";

// GitHub Pages serves the preview under a sub-path. Local builds and CI use the root.
const GITHUB_PAGES_BASE_PATH = "/pacholczyk-pogrzeby-www";
const onGithubPages = process.env.GITHUB_PAGES === "true";

const config: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  poweredByHeader: false,
  ...(onGithubPages
    ? {
        basePath: GITHUB_PAGES_BASE_PATH,
        assetPrefix: GITHUB_PAGES_BASE_PATH,
      }
    : {}),
};

export default config;
