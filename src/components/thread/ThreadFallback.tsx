import { farPath, SHAPES, type Shape } from "./shapes";
import type { ThreadVariant } from "./types";

/** soft：安靜版本（登入頁等）光暈減弱約 1/3，深色底上才不會搶過表單 */
function Svg({ s, className, soft = false }: { s: Shape; className: string; soft?: boolean }) {
  const k = soft ? 2 / 3 : 1;
  return (
    <svg viewBox={s.viewBox} preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false" className={className}>
      {s.far.map((c) => {
        const d = farPath(c);
        return <path key={d} d={d} fill="none" stroke="var(--color-far)" strokeWidth="1" />;
      })}
      <path d={s.path} fill="none" stroke="var(--color-thread-glow)" strokeOpacity={0.25 * k} strokeWidth="9" strokeLinecap="round" />
      <path d={s.path} fill="none" stroke="var(--color-thread)" strokeWidth="3" strokeLinecap="round" />
      {[s.a, s.b].map(([x, y]) => (
        <g key={`${x}-${y}`}>
          <circle cx={x} cy={y} r="14" fill="var(--color-thread-glow)" fillOpacity={0.18 * k} />
          <circle cx={x} cy={y} r="7" fill="none" stroke="var(--color-thread)" strokeWidth="3" />
        </g>
      ))}
    </svg>
  );
}

/** 靜態紅線。hero／quiet 依寬窄各一張（CSS 切換，不用 JS）。 */
export function ThreadFallback({ variant }: { variant: ThreadVariant }) {
  const abs = "absolute inset-0 h-full w-full";
  if (variant === "hero") {
    return (
      <>
        <Svg s={SHAPES.heroTall} className={`${abs} md:hidden`} />
        <Svg s={SHAPES.heroWide} className={`${abs} hidden md:block`} />
      </>
    );
  }
  if (variant === "quiet") {
    return (
      <>
        <Svg s={SHAPES.quietBand} className={`${abs} md:hidden`} soft />
        <Svg s={SHAPES.quietWide} className={`${abs} hidden md:block`} soft />
      </>
    );
  }
  return <Svg s={SHAPES.ribbon} className={abs} />;
}
