import { NAP } from "@/lib/nap";

export function PhoneLinks() {
  return (
    <p>
      {NAP.phones.map((phone, i) => (
        <span key={phone.e164}>
          {i > 0 ? " · " : null}
          <a href={`tel:${phone.e164}`}>{phone.display}</a>
        </span>
      ))}
    </p>
  );
}
