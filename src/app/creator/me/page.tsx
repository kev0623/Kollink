import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth/current-user";
import { SignOutButton } from "@/components/shell/SignOutButton";
import { CreatorSettingsForm } from "./CreatorSettingsForm";

export default function CreatorMePage() {
  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">我的</h1>
        <div className="md:hidden"><SignOutButton /></div>
      </div>
      <Suspense fallback={null}>
        <Settings />
      </Suspense>
    </>
  );
}

async function Settings() {
  const me = await getCurrentUser();
  if (!me?.creator || !me.profile) return null;
  const c = me.creator;
  return (
    <CreatorSettingsForm
      displayName={me.profile.displayName} handle={c.handle} igUsername={c.igUsername}
      followerCount={c.followerCount} region={c.region} categories={c.categories}
      handleEditable={!c.handleLocked}
    />
  );
}
