// robots.txt builder. Used by scripts/postbuild.ts.
// Preview policy: disallow all crawlers. No sitemap line.
// The site has no production domain yet, so no absolute sitemap URL exists.
// The launch issue adds a sitemap together with the domain.

export function buildRobotsTxt(preview: boolean): string {
  if (preview) {
    return [
      "# Preview. Not for search engines.",
      "User-agent: *",
      "Disallow: /",
      "",
    ].join("\n");
  }
  return ["User-agent: *", "Allow: /", ""].join("\n");
}
