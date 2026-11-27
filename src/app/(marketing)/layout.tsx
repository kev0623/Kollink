import { TopBar } from "@/components/landing/TopBar";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SkipLink } from "@/components/ui/SkipLink";

/** 公開說明頁（功能、收費、給品牌、給創作者）的外框：頂列＋內容＋頁尾。 */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bg">
      <SkipLink />
      <TopBar />
      <main id="main" tabIndex={-1} className="outline-none">{children}</main>
      <SiteFooter />
    </div>
  );
}
