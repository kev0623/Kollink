import type { Metadata } from "next";
import { h1 } from "@/components/ui/styles";
import { CreatorOnboardingForm } from "../CreatorOnboardingForm";

export const metadata: Metadata = { title: "建立創作者資料" };

export default function CreatorOnboardingPage() {
  return (
    <>
      <h1 className={`${h1} mb-2`}>填寫創作者資料</h1>
      <p className="mb-6 text-sm text-muted">送出後會進入審核。報價和作品可以之後再補。</p>
      <CreatorOnboardingForm />
    </>
  );
}
