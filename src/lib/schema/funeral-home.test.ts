import { describe, expect, it } from "vitest";
import { NAP } from "../nap";
import { buildFuneralHomeGraph } from "./funeral-home";

describe("buildFuneralHomeGraph", () => {
  const graph = buildFuneralHomeGraph();
  const nodes = graph["@graph"];

  it("has a context and two FuneralHome objects", () => {
    expect(graph["@context"]).toBe("https://schema.org");
    expect(nodes).toHaveLength(2);
    for (const node of nodes) expect(node["@type"]).toBe("FuneralHome");
  });

  it("matches the NAP for each office", () => {
    NAP.offices.forEach((office, i) => {
      const node = nodes[i];
      expect(node?.name).toBe(NAP.name);
      expect(node?.employee).toEqual({
        "@type": "Person",
        name: NAP.owner,
        jobTitle: "Właściciel",
      });
      expect(node?.address).toEqual({
        "@type": "PostalAddress",
        streetAddress: office.street,
        postalCode: office.postalCode,
        addressLocality: office.city,
        addressCountry: office.country,
      });
      expect(node?.telephone).toEqual(NAP.phones.map((p) => p.e164));
    });
  });

  it("states 24 h opening", () => {
    for (const node of nodes) {
      expect(node.openingHoursSpecification).toMatchObject({
        "@type": "OpeningHoursSpecification",
        dayOfWeek: [
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
          "Sunday",
        ],
        opens: "00:00",
        closes: "23:59",
      });
    }
  });

  it("has no e-mail, rating or geo data", () => {
    const json = JSON.stringify(graph);
    expect(json).not.toMatch(/email|@o2|aggregateRating|review|geo/i);
  });
});
