import { RolePicker } from "@/components/auth/RolePicker";

export default function OnboardingPage() {
  return (
    <>
      <h1 className="mb-6 text-2xl font-bold">你是品牌還是創作者？</h1>
      <RolePicker hrefFor={(r) => `/onboarding/${r}`} />
    </>
  );
}
