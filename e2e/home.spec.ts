import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

test.describe("home page", () => {
  test("answers 200 with lang pl and one h1", async ({ page }) => {
    const response = await page.goto("/");
    expect(response?.status()).toBe(200);
    await expect(page.locator("html")).toHaveAttribute("lang", "pl");
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator("h1")).toHaveText(
      "Zakład Usług Pogrzebowych Pacholczyk",
    );
  });

  test("viewport meta allows zoom", async ({ page }) => {
    await page.goto("/");
    const content = await page
      .locator('meta[name="viewport"]')
      .getAttribute("content");
    expect(content).toBeTruthy();
    expect(content).not.toMatch(/user-scalable\s*=\s*(no|0)/i);
    expect(content).not.toMatch(/maximum-scale\s*=\s*1(\.0)?\b/i);
  });

  test("has no axe violations", async ({ page }) => {
    await page.goto("/");
    const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
    expect(results.violations).toEqual([]);
  });

  test("is noindex", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      "noindex, nofollow",
    );
  });

  test("shows both offices and two tel: links", async ({ page }) => {
    await page.goto("/");
    const address = page.locator("address");
    await expect(address).toContainText("ul. Sienkiewicza 17");
    await expect(address).toContainText("99-210 Uniejów");
    await expect(address).toContainText("Plac Wojska Polskiego 10");
    await expect(address).toContainText("62-700 Turek");
    const hrefs = await page
      .locator('a[href^="tel:"]')
      .evaluateAll((links) => links.map((link) => link.getAttribute("href")));
    expect(hrefs).toEqual(["tel:+48632888554", "tel:+48609731454"]);
  });

  test("does not show the unconfirmed e-mail", async ({ page }) => {
    await page.goto("/");
    const html = await page.content();
    expect(html).not.toContain("jpacholczyk");
    expect(html).not.toContain("mailto:");
  });

  test("has two FuneralHome objects in JSON-LD", async ({ page }) => {
    await page.goto("/");
    const raw = await page
      .locator('script[type="application/ld+json"]')
      .allTextContents();
    const nodes = raw.flatMap((text) => {
      const data = JSON.parse(text) as { "@graph"?: { "@type": string }[] };
      return data["@graph"] ?? [data as { "@type": string }];
    });
    expect(nodes.filter((n) => n["@type"] === "FuneralHome")).toHaveLength(2);
  });
});

test.describe("static files", () => {
  test("robots.txt disallows all crawlers", async ({ request }) => {
    const response = await request.get("/robots.txt");
    expect(response.status()).toBe(200);
    expect(await response.text()).toContain("Disallow: /");
  });

  test("404 page exists", async ({ page }) => {
    const response = await page.goto("/nie-ma-takiej-strony/");
    expect(response?.status()).toBe(404);
    await expect(page.locator("h1")).toHaveCount(1);
  });
});
