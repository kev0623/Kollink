import type { Metadata } from "next";
import { CreatorOnboardingForm } from "../CreatorOnboardingForm";

export const metadata: Metadata = { title: "建立創作者資料" };

export default function CreatorOnboardingPage() {
  return (
    <>
      <h1 className="mb-2 text-[32px] font-bold text-ink">填寫創作者資料</h1>
      <p className="mb-6 text-sm text-muted">送出後會進入審核，通常 1–2 個工作天。報價和作品可以之後再補。</p>
      <CreatorOnboardingForm />
    </>
  );
}
