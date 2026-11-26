import Link from "next/link";
import { PhoneLinks } from "@/components/phone-links";

export default function NotFound() {
  return (
    <main>
      <h1>Nie znaleziono strony</h1>
      <p>Tej strony nie ma. Wróć na stronę główną albo zadzwoń.</p>
      <p>
        <Link href="/">Strona główna</Link>
      </p>
      <PhoneLinks />
    </main>
  );
}
