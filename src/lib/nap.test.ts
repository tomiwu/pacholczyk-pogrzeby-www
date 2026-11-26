import { describe, expect, it } from "vitest";
import { NAP } from "./nap";

describe("NAP", () => {
  it("has the business name and the owner", () => {
    expect(NAP.name).toBe("Zakład Usług Pogrzebowych Pacholczyk");
    expect(NAP.owner).toBe("Filip Pacholczyk");
  });

  it("has exactly two offices with PL addresses", () => {
    expect(NAP.offices).toHaveLength(2);
    const [uniejow, turek] = NAP.offices;
    expect(uniejow).toMatchObject({
      city: "Uniejów",
      street: "ul. Sienkiewicza 17",
      postalCode: "99-210",
      country: "PL",
    });
    expect(turek).toMatchObject({
      city: "Turek",
      street: "Plac Wojska Polskiego 10",
      postalCode: "62-700",
      country: "PL",
    });
  });

  it("has exactly two telephones in display and E.164 form", () => {
    expect(NAP.phones).toEqual([
      { display: "+48 63 288 85 54", e164: "+48632888554" },
      { display: "+48 609 731 454", e164: "+48609731454" },
    ]);
  });

  it("is open 24 h", () => {
    expect(NAP.open24h).toBe(true);
  });

  it("has no e-mail field until the PRD confirms it", () => {
    expect(JSON.stringify(NAP)).not.toMatch(/@/);
    expect(Object.keys(NAP)).not.toContain("email");
  });
});
