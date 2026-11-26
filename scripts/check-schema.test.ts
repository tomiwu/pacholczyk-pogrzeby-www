import { describe, expect, it } from "vitest";
import { buildFuneralHomeGraph } from "../src/lib/schema/funeral-home";
import { checkHtml, extractJsonLd } from "./check-schema";

function page(...blocks: string[]): string {
  const scripts = blocks
    .map((b) => `<script type="application/ld+json">${b}</script>`)
    .join("");
  return `<html lang="pl"><head>${scripts}</head><body></body></html>`;
}

const good = () => JSON.stringify(buildFuneralHomeGraph());

type Graph = ReturnType<typeof buildFuneralHomeGraph>;

function mutated(fn: (g: Graph) => void): string {
  const graph = structuredClone(buildFuneralHomeGraph());
  fn(graph);
  return JSON.stringify(graph);
}

describe("extractJsonLd", () => {
  it("finds every ld+json block", () => {
    expect(extractJsonLd(page("{}", "[]"))).toEqual(["{}", "[]"]);
  });

  it("ignores other script types", () => {
    expect(extractJsonLd('<script type="module">x</script>')).toEqual([]);
  });
});

describe("checkHtml", () => {
  it("accepts the generated graph", () => {
    expect(checkHtml("index.html", page(good()))).toEqual([]);
  });

  it("accepts two separate FuneralHome blocks", () => {
    const [a, b] = buildFuneralHomeGraph()["@graph"];
    const ctx = { "@context": "https://schema.org" };
    expect(
      checkHtml(
        "index.html",
        page(
          JSON.stringify({ ...ctx, ...a }),
          JSON.stringify({ ...ctx, ...b }),
        ),
      ),
    ).toEqual([]);
  });

  it("fails on invalid JSON", () => {
    const errors = checkHtml("index.html", page("{ nope"));
    expect(errors.join("\n")).toMatch(/invalid JSON/i);
  });

  it("fails on a missing @context", () => {
    const errors = checkHtml(
      "index.html",
      page(mutated((g) => delete (g as Partial<Graph>)["@context"])),
    );
    expect(errors.join("\n")).toMatch(/@context/);
  });

  it("fails on a missing @type", () => {
    const errors = checkHtml(
      "index.html",
      page(
        mutated((g) => {
          delete (g["@graph"][0] as { "@type"?: string })["@type"];
        }),
      ),
    );
    expect(errors.join("\n")).toMatch(/@type/);
  });

  it("fails when the page has no FuneralHome", () => {
    const errors = checkHtml("index.html", page());
    expect(errors.join("\n")).toMatch(/two FuneralHome/);
  });

  it("fails when the page has one FuneralHome", () => {
    const errors = checkHtml(
      "index.html",
      page(mutated((g) => g["@graph"].pop())),
    );
    expect(errors.join("\n")).toMatch(/two FuneralHome/);
  });

  it("fails when the name differs from NAP", () => {
    const errors = checkHtml(
      "index.html",
      page(
        mutated((g) => {
          g["@graph"][0]!.name = "Inna Firma";
        }),
      ),
    );
    expect(errors.join("\n")).toMatch(/name/);
  });

  it("fails when the address differs from NAP", () => {
    const errors = checkHtml(
      "index.html",
      page(
        mutated((g) => {
          const address = g["@graph"][1]!.address as { streetAddress: string };
          address.streetAddress = "ul. Zmyślona 1";
        }),
      ),
    );
    expect(errors.join("\n")).toMatch(/address/);
  });

  it("fails when a telephone differs from NAP", () => {
    const errors = checkHtml(
      "index.html",
      page(
        mutated((g) => {
          g["@graph"][0]!.telephone = ["+48000000000"];
        }),
      ),
    );
    expect(errors.join("\n")).toMatch(/telephone/);
  });

  it("does not demand FuneralHome on the error pages", () => {
    for (const file of [
      "404.html",
      "404/index.html",
      "_not-found/index.html",
    ]) {
      expect(checkHtml(file, page())).toEqual([]);
    }
  });

  describe("FAQPage", () => {
    const faq = (mainEntity: unknown) =>
      JSON.stringify({
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity,
      });
    const question = (text?: string) => ({
      "@type": "Question",
      name: "Pytanie testowe?",
      acceptedAnswer: { "@type": "Answer", ...(text ? { text } : {}) },
    });

    it("accepts a question with an answer", () => {
      expect(
        checkHtml("index.html", page(good(), faq([question("Odpowiedź.")]))),
      ).toEqual([]);
    });

    it("is not required", () => {
      expect(checkHtml("index.html", page(good()))).toEqual([]);
    });

    it("fails with no questions", () => {
      const errors = checkHtml("index.html", page(good(), faq([])));
      expect(errors.join("\n")).toMatch(/FAQPage/);
    });

    it("fails when an answer has no text", () => {
      const errors = checkHtml("index.html", page(good(), faq([question()])));
      expect(errors.join("\n")).toMatch(/acceptedAnswer\.text/);
    });
  });
});
