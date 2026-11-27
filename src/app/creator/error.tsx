"use client";

import { ErrorScreen } from "@/components/ui/ErrorScreen";

/** 創作者後台：出錯時保留側欄與底部導覽，只換內容區。 */
export default function CreatorError({ error, retry }: { error: unknown; retry: () => void }) {
  return <ErrorScreen error={error} retry={retry} scope="section" home={{ href: "/creator", label: "回機會" }} />;
}
