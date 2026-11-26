import Link from "next/link";
import { btn } from "./styles";
import { ThreadMark } from "./ThreadMark";

/** 空狀態（規格 §9.9）：一段沒打結的紅線、一句話、最多一個動作。 */
export function EmptyState({ text, action }: { text: string; action?: { href: string; label: string } }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-card border border-line bg-surface px-6 py-10 text-center">
      <ThreadMark variant="loose" />
      <p className="max-w-sm text-sm text-muted">{text}</p>
      {action && <Link href={action.href} className={btn.primary}>{action.label}</Link>}
    </div>
  );
}
