"use client";

import { ErrorScreen } from "@/components/ui/ErrorScreen";

/** 創作者公開頁：出錯時保留頂列。 */
export default function PublicProfileError({ error, retry }: { error: unknown; retry: () => void }) {
  return <ErrorScreen error={error} retry={retry} scope="section" home={{ href: "/", label: "回首頁" }} />;
}
