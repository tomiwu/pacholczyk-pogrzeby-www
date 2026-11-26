// Validate the JSON-LD in every HTML file of the static export.
// Usage: tsx scripts/check-schema.ts <dir>
//
// Rules:
// - Every ld+json block is valid JSON.
// - Every top-level object has @context. Every node has @type.
// - Every content page has two FuneralHome objects that match src/lib/nap.ts.
// - A FAQPage has at least one Question with acceptedAnswer.text.
//   A FAQPage is not required yet.
// - Error pages (404) need no FuneralHome objects.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";
import { NAP } from "../src/lib/nap";

type Json = unknown;
type Node = Record<string, Json>;

const ERROR_PAGES = new Set([
  "404.html",
  "404/index.html",
  "_not-found/index.html",
]);

const LD_JSON_RE =
  /<script\b[^>]*\btype\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

export function extractJsonLd(html: string): string[] {
  return [...html.matchAll(LD_JSON_RE)].map((match) => match[1] ?? "");
}

function isNode(value: Json): value is Node {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asArray(value: Json): Json[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function typesOf(node: Node): string[] {
  return asArray(node["@type"]).filter(
    (t): t is string => typeof t === "string",
  );
}

function sameSet(a: readonly string[], b: readonly string[]): boolean {
  return (
    a.length === b.length && [...a].sort().join("|") === [...b].sort().join("|")
  );
}

function officeKey(office: {
  street: string;
  postalCode: string;
  city: string;
  country: string;
}): string {
  return [office.street, office.postalCode, office.city, office.country].join(
    "|",
  );
}

function addressKey(address: Json): string | null {
  if (!isNode(address) || address["@type"] !== "PostalAddress") return null;
  const parts = [
    address["streetAddress"],
    address["postalCode"],
    address["addressLocality"],
    address["addressCountry"],
  ];
  return parts.every((p) => typeof p === "string") ? parts.join("|") : null;
}

function checkFuneralHomes(file: string, homes: Node[]): string[] {
  const errors: string[] = [];
  if (homes.length !== 2) {
    errors.push(
      `${file}: expected two FuneralHome objects, found ${homes.length}`,
    );
  }
  const expectedPhones = NAP.phones.map((p) => p.e164);
  const seen = new Set<string>();
  homes.forEach((home, i) => {
    const label = `${file}: FuneralHome #${i + 1}`;
    if (home["name"] !== NAP.name) {
      errors.push(`${label}: name differs from nap.ts`);
    }
    const key = addressKey(home["address"]);
    const known = NAP.offices.some((o) => officeKey(o) === key);
    if (key === null || !known) {
      errors.push(`${label}: address differs from nap.ts`);
    } else if (seen.has(key)) {
      errors.push(`${label}: address repeats another FuneralHome`);
    } else {
      seen.add(key);
    }
    const phones = asArray(home["telephone"]).filter(
      (t): t is string => typeof t === "string",
    );
    if (!sameSet(phones, expectedPhones)) {
      errors.push(`${label}: telephone differs from nap.ts`);
    }
  });
  return errors;
}

function checkFaq(file: string, faq: Node): string[] {
  const questions = asArray(faq["mainEntity"]).filter(isNode);
  const label = `${file}: FAQPage`;
  if (questions.length === 0) {
    return [`${label}: needs at least one Question`];
  }
  const errors: string[] = [];
  questions.forEach((q, i) => {
    if (!typesOf(q).includes("Question")) {
      errors.push(`${label}: mainEntity #${i + 1} is not a Question`);
    }
    const answer = q["acceptedAnswer"];
    const text = isNode(answer) ? answer["text"] : undefined;
    if (typeof text !== "string" || text.trim() === "") {
      errors.push(`${label}: Question #${i + 1} needs acceptedAnswer.text`);
    }
  });
  return errors;
}

// Returns a list of error messages. An empty list means the file is valid.
export function checkHtml(file: string, html: string): string[] {
  const errors: string[] = [];
  const nodes: Node[] = [];

  extractJsonLd(html).forEach((raw, i) => {
    const label = `${file}: block #${i + 1}`;
    let data: Json;
    try {
      data = JSON.parse(raw);
    } catch {
      errors.push(`${label}: invalid JSON`);
      return;
    }
    for (const top of asArray(data)) {
      if (!isNode(top)) {
        errors.push(`${label}: not a JSON object`);
        continue;
      }
      if (!top["@context"]) errors.push(`${label}: missing @context`);
      const members = "@graph" in top ? asArray(top["@graph"]) : [top];
      for (const member of members) {
        if (!isNode(member)) {
          errors.push(`${label}: @graph member is not a JSON object`);
        } else if (typesOf(member).length === 0) {
          errors.push(`${label}: missing @type`);
        } else {
          nodes.push(member);
        }
      }
    }
  });

  const homes = nodes.filter((n) => typesOf(n).includes("FuneralHome"));
  if (!ERROR_PAGES.has(file)) {
    errors.push(...checkFuneralHomes(file, homes));
  }
  for (const faq of nodes.filter((n) => typesOf(n).includes("FAQPage"))) {
    errors.push(...checkFaq(file, faq));
  }
  return errors;
}

function listHtml(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return listHtml(full);
    return full.endsWith(".html") ? [full] : [];
  });
}

function main(dir: string | undefined): number {
  if (!dir) {
    console.error("Usage: tsx scripts/check-schema.ts <dir>");
    return 2;
  }
  let files: string[];
  try {
    files = listHtml(dir);
  } catch {
    console.error(`Cannot read directory: ${dir}. Run the build first.`);
    return 2;
  }
  if (files.length === 0) {
    console.error(`No HTML files in ${dir}.`);
    return 2;
  }
  const errors = files.flatMap((full) =>
    checkHtml(relative(dir, full), readFileSync(full, "utf8")),
  );
  if (errors.length > 0) {
    console.error(errors.join("\n"));
    return 1;
  }
  console.log(`JSON-LD OK in ${files.length} HTML file(s).`);
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  process.exitCode = main(process.argv[2]);
}
