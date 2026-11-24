import { signOut } from "@/app/auth/actions";

export function SignOutButton() {
  return (
    <form action={signOut}>
      <button className="text-sm text-muted hover:text-ink">登出</button>
    </form>
  );
}
