import type { Metadata, Viewport } from "next";
import { Manrope, Noto_Sans_TC, Noto_Serif_TC } from "next/font/google";
import "./globals.css";
import { ThemeSync } from "@/components/theme/ThemeSync";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/site";
import { LANG_SCRIPT } from "@/lib/lang";
import { THEME_COLORS, THEME_SCRIPT } from "@/lib/theme";

// 規格 §3：中文字型切成 unicode-range 小檔，不 preload（瀏覽器只抓用到的切片）；Manrope 只有 latin、preload。
const manrope = Manrope({ subsets: ["latin"], display: "swap", variable: "--font-manrope" });
const notoSans = Noto_Sans_TC({ weight: ["400", "700"], display: "swap", preload: false, variable: "--font-noto-sans" });
const notoSerif = Noto_Serif_TC({ weight: ["700", "900"], display: "swap", preload: false, variable: "--font-noto-serif" });

export const metadata: Metadata = {
  title: { default: SITE_NAME, template: `%s｜${SITE_NAME}` },
  description: SITE_TAGLINE,
};

// viewport-fit=cover：底部導覽列要用 env(safe-area-inset-bottom)
export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: THEME_COLORS.dark },
    { media: "(prefers-color-scheme: light)", color: THEME_COLORS.light },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // data-theme 由 <head> 的腳本在繪製前設定（沒有 JS 時 CSS 跟隨系統），所以 html 要 suppressHydrationWarning
    <html lang="zh-Hant" suppressHydrationWarning className={`${manrope.variable} ${notoSans.variable} ${notoSerif.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT + LANG_SCRIPT }} />
      </head>
      <body className="font-sans antialiased">
        {children}
        <ThemeSync />
      </body>
    </html>
  );
}
