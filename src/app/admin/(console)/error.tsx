"use client";

import { ErrorScreen } from "@/components/ui/ErrorScreen";

/** 管理後台：出錯時保留側欄與底部導覽，只換內容區。 */
export default function AdminError({ error, retry }: { error: unknown; retry: () => void }) {
  return <ErrorScreen error={error} retry={retry} scope="section" home={{ href: "/admin", label: "回總覽" }} />;
}
