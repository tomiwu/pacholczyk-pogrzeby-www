// Single source of truth for name, address and telephone (NAP).
// Do not copy these values anywhere else. Import them.
// Do not add an e-mail field until docs/PRD.md marks the e-mail as confirmed.

export type Office = {
  readonly id: "uniejow" | "turek";
  readonly city: string;
  readonly street: string;
  readonly postalCode: string;
  readonly country: "PL";
};

export type Phone = {
  readonly display: string;
  readonly e164: string;
};

export const NAP = {
  name: "Zakład Usług Pogrzebowych Pacholczyk",
  owner: "Filip Pacholczyk",
  offices: [
    {
      id: "uniejow",
      city: "Uniejów",
      street: "ul. Sienkiewicza 17",
      postalCode: "99-210",
      country: "PL",
    },
    {
      id: "turek",
      city: "Turek",
      street: "Plac Wojska Polskiego 10",
      postalCode: "62-700",
      country: "PL",
    },
  ],
  // Both numbers serve both offices.
  phones: [
    { display: "+48 63 288 85 54", e164: "+48632888554" },
    { display: "+48 609 731 454", e164: "+48609731454" },
  ],
  open24h: true,
} as const satisfies {
  name: string;
  owner: string;
  offices: readonly Office[];
  phones: readonly Phone[];
  open24h: boolean;
};
