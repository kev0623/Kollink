"use client";

import { ErrorScreen } from "@/components/ui/ErrorScreen";

/** 品牌後台：出錯時保留側欄與底部導覽，只換內容區。 */
export default function BrandError({ error, retry }: { error: unknown; retry: () => void }) {
  return <ErrorScreen error={error} retry={retry} scope="section" home={{ href: "/brand", label: "回創作者廣場" }} />;
}
