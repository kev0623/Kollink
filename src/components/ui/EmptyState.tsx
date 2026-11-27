import Link from "next/link";
import { btn } from "./styles";
import { ThreadMark } from "./ThreadMark";

/** href：連到別頁；onClick：留在這一頁（清除篩選等，只能在 client 元件裡用）。 */
export type EmptyAction = { label: React.ReactNode } & ({ href: string; onClick?: undefined } | { onClick: () => void; href?: undefined });

/**
 * 空狀態（規格 §9.9）：一段沒打結的紅線、一句話說明現在的狀況與下一步、最多一個主要動作。
 * secondary 是次要出路（例如主要動作是「刊登招募」時的「看全部」），用描邊按鈕。
 */
export function EmptyState({ text, action, secondary }: { text: React.ReactNode; action?: EmptyAction; secondary?: EmptyAction }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-card border border-line bg-surface px-6 py-10 text-center">
      <ThreadMark variant="loose" />
      <p className="max-w-sm text-balance text-sm text-muted">{text}</p>
      {(action || secondary) && (
        <div className="flex flex-wrap justify-center gap-3">
          {action && <Act a={action} className={btn.primary} />}
          {secondary && <Act a={secondary} className={btn.secondary} />}
        </div>
      )}
    </div>
  );
}

function Act({ a, className }: { a: EmptyAction; className: string }) {
  return a.href !== undefined
    ? <Link href={a.href} className={className}>{a.label}</Link>
    : <button type="button" onClick={a.onClick} className={className}>{a.label}</button>;
}
