import Link from "next/link";
import { Notice } from "@/components/ui/Notice";
import { btn } from "@/components/ui/styles";

/** 沒有收款帳戶的提醒（QA m19）：合作案行動卡上方與機會頁頂部。 */
export function PayoutPrompt() {
  return (
    <Notice tone="warning" title="還沒有收款帳戶，平台無法撥款給你">
      <p>填好帳戶後，合作完成就會全額撥款。只有你和平台看得到，品牌看不到。</p>
      <Link href="/creator/me/payout" className={`${btn.secondary} mt-3`}>設定收款帳戶</Link>
    </Notice>
  );
}
