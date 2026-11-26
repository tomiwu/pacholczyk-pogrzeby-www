import type { LocalBusinessLeaf } from "schema-dts";
import { NAP, type Office } from "../nap";

// schema-dts has no FuneralHome type, but the PRD asks for @type FuneralHome.
// The properties are the same as for LocalBusiness.
export type FuneralHome = Omit<LocalBusinessLeaf, "@type"> & {
  "@type": "FuneralHome";
};

const ALL_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

function buildOffice(office: Office): FuneralHome {
  return {
    "@type": "FuneralHome",
    name: NAP.name,
    employee: {
      "@type": "Person",
      name: NAP.owner,
      jobTitle: "Właściciel",
    },
    address: {
      "@type": "PostalAddress",
      streetAddress: office.street,
      postalCode: office.postalCode,
      addressLocality: office.city,
      addressCountry: office.country,
    },
    telephone: NAP.phones.map((phone) => phone.e164),
    openingHoursSpecification: {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: [...ALL_DAYS],
      opens: "00:00",
      closes: "23:59",
    },
  };
}

export type FuneralHomeGraph = {
  "@context": "https://schema.org";
  "@graph": FuneralHome[];
};

// Returns one FuneralHome per office.
export function buildFuneralHomeGraph(): FuneralHomeGraph {
  return {
    "@context": "https://schema.org",
    "@graph": NAP.offices.map(buildOffice),
  };
}
