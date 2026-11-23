import type { Metadata } from "next";
import { Noto_Sans_TC } from "next/font/google";
import "./globals.css";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/site";

const notoSansTC = Noto_Sans_TC({
  weight: ["400", "500", "700"],
  variable: "--font-noto-sans-tc",
  preload: false,
});

export const metadata: Metadata = {
  title: SITE_NAME,
  description: SITE_TAGLINE,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant" className={notoSansTC.variable}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
