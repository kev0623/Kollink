import { LogOut } from "lucide-react";
import { signOut } from "@/app/auth/actions";

export function SignOutButton() {
  return (
    <form action={signOut}>
      <button className="inline-flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-btn px-3 text-sm text-muted hover:bg-subtle hover:text-ink">
        <LogOut size={16} strokeWidth={1.5} aria-hidden="true" />登出
      </button>
    </form>
  );
}
