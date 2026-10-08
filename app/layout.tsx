import type { Metadata } from "next";
import "./globals.css";
import "@fontsource-variable/manrope";

export const metadata: Metadata = {
  title: "Степан — один день",
  description: "Один день в движении. Разработка, безопасность, ИТМО и философия — личный сайт Степана.",
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
