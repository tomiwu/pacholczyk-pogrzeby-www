// Run after `next build`. Writes files that Next.js does not write.
// Today: out/robots.txt. The policy comes from src/lib/preview.ts.
// There is no sitemap.xml. The site has no production domain, so no absolute URL exists.
// The launch issue adds a sitemap together with the domain.

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PREVIEW_NOINDEX } from "../src/lib/preview";
import { buildRobotsTxt } from "../src/lib/robots";

const OUT_DIR = "out";

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(join(OUT_DIR, "robots.txt"), buildRobotsTxt(PREVIEW_NOINDEX));
console.log(
  `Wrote ${OUT_DIR}/robots.txt (${PREVIEW_NOINDEX ? "preview: disallow all" : "launch: allow"}).`,
);
