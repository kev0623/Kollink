import type { Metadata } from "next";
import { RolePicker } from "@/components/auth/RolePicker";
import { h1 } from "@/components/ui/styles";

export const metadata: Metadata = { title: "選擇身分" };

export default function OnboardingPage() {
  return (
    <>
      <h1 className={`${h1} mb-6`}>你是品牌還是創作者？</h1>
      <RolePicker hrefFor={(r) => `/onboarding/${r}`} />
    </>
  );
}
