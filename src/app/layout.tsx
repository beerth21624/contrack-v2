import type { Metadata } from "next";
import { Geist_Mono, IBM_Plex_Sans_Thai, Sarabun } from "next/font/google";
import "./globals.css";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { LocaleProvider } from "@/i18n/LocaleProvider";

/** UI font (docs/rebuild/DESIGN_SYSTEM.md): Thai + Latin in one family, tabular figures for amounts. */
const plexThai = IBM_Plex_Sans_Thai({
  variable: "--font-plex-thai",
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/** Document font: the print / PDF BOQ only (read as --font-sarabun by src/features/export). */
const sarabun = Sarabun({
  variable: "--font-sarabun",
  subsets: ["thai", "latin"],
  weight: ["300", "400", "600", "700"],
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("app");
  return { title: t("metaTitle"), description: t("metaDescription") };
}

import type { Viewport } from "next";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // The UI locale comes from the NEXT_LOCALE cookie (src/i18n/request.ts); Thai when there is none.
  const locale = await getLocale();
  const messages = await getMessages();
  return (
    <html lang={locale}>
      <body
        className={`${plexThai.variable} ${geistMono.variable} ${sarabun.variable} antialiased`}
      >
        <AntdRegistry>
          <NextIntlClientProvider locale={locale} messages={messages} timeZone="Asia/Bangkok">
            <LocaleProvider>{children}</LocaleProvider>
          </NextIntlClientProvider>
        </AntdRegistry>
      </body>
    </html>
  );
}
