import type { Metadata } from "next";
import "../../globals.css";
import "@fontsource-variable/manrope";
import { languageScript } from "../../components/language";
import { metadataFor } from "../../components/copy";

export const metadata: Metadata = {
  ...metadataFor("en"),
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
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: languageScript("en") }} />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
