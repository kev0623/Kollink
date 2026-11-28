import { TopBar } from "@/components/landing/TopBar";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SkipLink } from "@/components/ui/SkipLink";

/** 公開的創作者列表外框：與其他公開頁相同的頂列與頁尾，不套登入後的側邊導覽。 */
export default function CreatorsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bg">
      <SkipLink />
      <TopBar />
      <main id="main" tabIndex={-1} className="page-in mx-auto max-w-[1280px] px-5 pb-20 pt-4 outline-none md:px-16">{children}</main>
      <SiteFooter />
    </div>
  );
}
