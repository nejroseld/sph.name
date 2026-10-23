import type { Metadata } from "next";
import "../globals.css";
import "@fontsource-variable/manrope";
import { metadataFor } from "../components/copy";

// Each language has its own root layout so the document's lang attribute is right from the first byte.
export const metadata: Metadata = {
  ...metadataFor("ru"),
  alternates: { languages: { ru: "/", en: "/en" } },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body className="antialiased">{children}</body>
    </html>
  );
}
