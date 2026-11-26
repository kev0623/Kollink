"use client";

import { ErrorScreen } from "@/components/ui/ErrorScreen";

/** 填資料流程：出錯時保留頂列。 */
export default function OnboardingError({ error, retry }: { error: unknown; retry: () => void }) {
  return <ErrorScreen error={error} retry={retry} scope="section" home={{ href: "/onboarding", label: "重新選擇身分" }} />;
}
