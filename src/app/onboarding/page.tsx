import type { Metadata } from "next";
import { RolePicker } from "@/components/auth/RolePicker";

export const metadata: Metadata = { title: "選擇身分" };

export default function OnboardingPage() {
  return (
    <>
      <h1 className="mb-6 text-[32px] font-bold text-ink">你是品牌還是創作者？</h1>
      <RolePicker hrefFor={(r) => `/onboarding/${r}`} />
    </>
  );
}
