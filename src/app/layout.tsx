import type { Metadata } from "next";
import type { ReactNode } from "react";
import { NAP } from "@/lib/nap";
import { PREVIEW_NOINDEX } from "@/lib/preview";
import "./globals.css";

export const metadata: Metadata = {
  title: NAP.name,
  description:
    "Zakład Usług Pogrzebowych Pacholczyk. Biura w Uniejowie i w Turku. Pomoc całą dobę.",
  robots: PREVIEW_NOINDEX
    ? { index: false, follow: false }
    : { index: true, follow: true },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pl">
      <body>{children}</body>
    </html>
  );
}
