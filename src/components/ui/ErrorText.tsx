import { AlertCircle } from "lucide-react";
import { mentionsSupport } from "@/lib/support";
import { SupportLink } from "./SupportLink";

/** Server Action 的錯誤：圖示＋文字；提到「聯絡平台／客服」時接上聯絡方式（QA M4）。 */
export function ErrorText({ message, subject }: { message: string | null | undefined; subject?: string }) {
  if (!message) return null;
  return (
    <div role="alert" className="text-sm text-danger">
      <p className="flex items-start gap-1.5">
        <AlertCircle size={16} strokeWidth={1.5} aria-hidden="true" className="mt-0.5 shrink-0" />
        <span className="min-w-0 break-words">{message}</span>
      </p>
      {mentionsSupport(message) && <div className="mt-1 pl-5 text-ink"><SupportLink subject={subject} /></div>}
    </div>
  );
}
