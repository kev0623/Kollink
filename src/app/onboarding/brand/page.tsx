import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth/current-user";
import { BrandOnboardingForm } from "../BrandOnboardingForm";

export default function BrandOnboardingPage() {
  return (
    <>
      <h1 className="mb-6 text-2xl font-bold">填寫品牌資料</h1>
      <Suspense fallback={null}>
        <Form />
      </Suspense>
    </>
  );
}

async function Form() {
  const me = await getCurrentUser();
  if (!me) return null; // layout 已處理導向
  return <BrandOnboardingForm userId={me.id} />;
}
