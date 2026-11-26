/** 一小段 SVG 紅線。variant：loose（未打結，空狀態）／broken（斷開，找不到頁面）／tied（兩端打結）。純裝飾。 */
export function ThreadMark({ variant, className = "" }: { variant: "loose" | "broken" | "tied"; className?: string }) {
  return (
    <svg viewBox="0 0 160 48" aria-hidden="true" focusable="false" className={`h-12 w-40 ${className}`}>
      {variant === "broken" ? (
        <>
          <path d="M8 34 C 30 8, 52 8, 68 24" fill="none" stroke="var(--color-thread)" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M92 26 C 108 40, 130 40, 152 14" fill="none" stroke="var(--color-thread)" strokeWidth="2.5" strokeLinecap="round" />
        </>
      ) : (
        <path d="M8 34 C 40 2, 72 46, 104 22 S 140 10, 152 18" fill="none" stroke="var(--color-thread)" strokeWidth="2.5" strokeLinecap="round" />
      )}
      <circle cx="8" cy="34" r="5" fill="var(--color-thread)" />
      {variant === "tied" && <circle cx="152" cy="18" r="5" fill="var(--color-thread)" />}
    </svg>
  );
}
