import type { ThreadVariant } from "./types";

type Shape = { viewBox: string; path: string; a: [number, number]; b: [number, number]; far: string[] };

// 構圖取自原型截圖（scratchpad ui-plan/shots/），與 thread-scene.ts 的錨點一致
const SHAPES: Record<"heroWide" | "heroTall" | "quietWide" | "quietBand" | "ribbon", Shape> = {
  heroWide: {
    viewBox: "0 0 1280 900", path: "M180 232 C 360 420, 600 520, 790 502 S 1040 430, 1118 365", a: [180, 232], b: [1118, 365],
    far: ["M0 104 C 400 150, 900 120, 1280 62", "M0 250 C 300 380, 700 260, 1280 110", "M0 470 C 500 520, 900 600, 1280 590", "M0 690 C 400 640, 900 780, 1280 760"],
  },
  heroTall: {
    viewBox: "0 0 390 844", path: "M40 160 C 100 300, 170 400, 232 396 S 318 360, 338 340", a: [40, 160], b: [338, 340],
    far: ["M0 124 C 150 118, 260 112, 390 108", "M0 306 C 140 250, 260 190, 390 140"],
  },
  quietWide: {
    viewBox: "0 0 704 900", path: "M145 163 C 200 360, 330 640, 540 647 S 600 636, 620 632", a: [145, 163], b: [620, 632],
    far: ["M0 129 C 300 135, 500 110, 704 92", "M0 336 C 250 330, 500 200, 704 96", "M0 713 C 200 740, 400 820, 704 890"],
  },
  quietBand: { viewBox: "0 0 390 160", path: "M24 40 C 120 150, 260 150, 366 60", a: [24, 40], b: [366, 60], far: [] },
  ribbon: { viewBox: "0 0 1200 96", path: "M0 60 C 300 20, 500 90, 700 48 S 1000 30, 1200 56", a: [-20, 60], b: [1220, 56], far: [] },
};

function Svg({ s, className }: { s: Shape; className: string }) {
  return (
    <svg viewBox={s.viewBox} preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false" className={className}>
      {s.far.map((d) => <path key={d} d={d} fill="none" stroke="var(--color-far)" strokeWidth="1" />)}
      <path d={s.path} fill="none" stroke="var(--color-thread-glow)" strokeOpacity="0.25" strokeWidth="9" strokeLinecap="round" />
      <path d={s.path} fill="none" stroke="var(--color-thread)" strokeWidth="3" strokeLinecap="round" />
      {[s.a, s.b].map(([x, y]) => (
        <g key={`${x}-${y}`}>
          <circle cx={x} cy={y} r="14" fill="var(--color-thread-glow)" fillOpacity="0.18" />
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
        <Svg s={SHAPES.quietBand} className={`${abs} md:hidden`} />
        <Svg s={SHAPES.quietWide} className={`${abs} hidden md:block`} />
      </>
    );
  }
  return <Svg s={SHAPES.ribbon} className={abs} />;
}
