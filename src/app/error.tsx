"use client";

import { ErrorScreen } from "@/components/ui/ErrorScreen";

/** 全站的錯誤畫面：沒有更近的 error.tsx 時顯示（包含各區 layout 的守門出錯）。根 layout 本身出錯由 global-error.tsx 處理。 */
export default function RootError({ error, retry }: { error: unknown; retry: () => void }) {
  return <ErrorScreen error={error} retry={retry} scope="page" home={{ href: "/", label: "回首頁" }} />;
}
