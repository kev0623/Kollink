import type { Metadata } from "next";
import { Noto_Sans_TC } from "next/font/google";
import "./globals.css";

const notoSansTC = Noto_Sans_TC({
  weight: ["400", "500", "700"],
  variable: "--font-noto-sans-tc",
  preload: false,
});

export const metadata: Metadata = {
  title: "Pollen",
  description: "台灣品牌 × 創作者合作平台",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant" className={notoSansTC.variable}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
