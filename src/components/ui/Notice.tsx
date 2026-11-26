import { AlertCircle, AlertTriangle, CheckCircle2, Info } from "lucide-react";

type Tone = "info" | "success" | "warning" | "danger";

const TONE: Record<Tone, { box: string; Icon: typeof Info }> = {
  info: { box: "border-line bg-subtle text-ink", Icon: Info },
  success: { box: "border-success bg-success-soft text-ink", Icon: CheckCircle2 },
  warning: { box: "border-primary bg-primary-soft text-ink", Icon: AlertTriangle },
  danger: { box: "border-danger bg-danger-soft text-ink", Icon: AlertCircle },
};

/** 頁內通知（規格 §9.10）：圖示＋文字，不只靠顏色。danger 用 role="alert"，其他 role="status"。 */
export function Notice({ tone, title, children, className = "" }: {
  tone: Tone; title?: string; children?: React.ReactNode; className?: string;
}) {
  const { box, Icon } = TONE[tone];
  const iconColor = tone === "success" ? "text-success" : tone === "danger" ? "text-danger" : tone === "warning" ? "text-accent" : "text-muted";
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={`flex gap-3 rounded-input border p-4 text-sm ${box} ${className}`}>
      <Icon size={18} strokeWidth={1.5} aria-hidden="true" className={`mt-0.5 shrink-0 ${iconColor}`} />
      <div className="min-w-0 break-words">
        {title && <p className="font-bold">{title}</p>}
        {children && <div className={title ? "mt-1" : ""}>{children}</div>}
      </div>
    </div>
  );
}
