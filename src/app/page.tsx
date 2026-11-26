import { PhoneLinks } from "@/components/phone-links";
import { NAP } from "@/lib/nap";
import { buildFuneralHomeGraph } from "@/lib/schema/funeral-home";

export default function Home() {
  const jsonLd = JSON.stringify(buildFuneralHomeGraph()).replace(
    /</g,
    "\\u003c",
  );
  return (
    <main>
      <h1>{NAP.name}</h1>
      <p>Strona jest w przygotowaniu. Zadzwoń: pomagamy całą dobę.</p>
      <PhoneLinks />
      <address>
        {NAP.offices.map((office) => (
          <p key={office.id}>
            <strong>Biuro {office.city}</strong>
            <br />
            {office.street}
            <br />
            {office.postalCode} {office.city}
          </p>
        ))}
      </address>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd }}
      />
    </main>
  );
}
