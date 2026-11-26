import Link from "next/link";
import { NAP } from "@/lib/nap";

export default function NotFound() {
  return (
    <main>
      <h1>Nie znaleziono strony</h1>
      <p>Tej strony nie ma. Wróć na stronę główną albo zadzwoń.</p>
      <p>
        <Link href="/">Strona główna</Link>
      </p>
      <p>
        {NAP.phones.map((phone, i) => (
          <span key={phone.e164}>
            {i > 0 ? " · " : null}
            <a href={`tel:${phone.e164}`}>{phone.display}</a>
          </span>
        ))}
      </p>
    </main>
  );
}
