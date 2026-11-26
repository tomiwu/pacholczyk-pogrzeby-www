import { describe, expect, it } from "vitest";
import { PREVIEW_NOINDEX } from "./preview";
import { buildRobotsTxt } from "./robots";

describe("preview policy", () => {
  it("is noindex until launch", () => {
    expect(PREVIEW_NOINDEX).toBe(true);
  });

  it("disallows all crawlers in preview and has no sitemap line", () => {
    const txt = buildRobotsTxt(true);
    expect(txt).toMatch(/^User-agent: \*$/m);
    expect(txt).toMatch(/^Disallow: \/$/m);
    expect(txt).not.toMatch(/sitemap/i);
  });

  it("allows crawlers after launch", () => {
    const txt = buildRobotsTxt(false);
    expect(txt).toMatch(/^Allow: \/$/m);
    expect(txt).not.toMatch(/^Disallow: \/$/m);
  });
});
