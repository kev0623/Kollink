import { describe, expect, it } from "vitest";
import { pushScale, ropeLength, stepRope, type Vec3 } from "./rope";

// 與 thread-scene 相同的尺度：相機 z=10、fov 35°
const HH = 10 * Math.tan((35 * Math.PI) / 360);

function makeRope(opts: { aspect: number; heightPx: number; points: number; slack: number; a: [number, number, number]; b: [number, number, number]; radiusPx: number }) {
  const hw = HH * opts.aspect;
  const a: Vec3 = { x: opts.a[0] * hw, y: opts.a[1] * HH, z: opts.a[2] };
  const b: Vec3 = { x: opts.b[0] * hw, y: opts.b[1] * HH, z: opts.b[2] };
  const N = opts.points;
  const dist = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
  const rest = (dist * opts.slack) / (N - 1);
  const pos: Vec3[] = [];
  const prev: Vec3[] = [];
  for (let i = 0; i < N; i++) {
    const s = i / (N - 1);
    const p = { x: a.x + (b.x - a.x) * s, y: a.y + (b.y - a.y) * s - dist * 0.15 * 4 * s * (1 - s), z: a.z + (b.z - a.z) * s };
    pos.push(p);
    prev.push({ ...p });
  }
  const radius = opts.radiusPx * ((2 * HH) / opts.heightPx);
  return { a, b, pos, prev, rest, radius, N };
}

const desktop = { aspect: 1280 / 900, heightPx: 900, points: 48, slack: 1.08, a: [-0.68, 0.46, 0.5] as [number, number, number], b: [0.8, 0.2, -0.7] as [number, number, number], radiusPx: 140 };
const mobile = { aspect: 390 / 844, heightPx: 844, points: 32, slack: 1.24, a: [-0.76, 0.6, 0.3] as [number, number, number], b: [0.76, 0.2, -0.4] as [number, number, number], radiusPx: 90 };

describe("stepRope", () => {
  for (const [name, cfg] of [["桌面", desktop], ["手機", mobile]] as const) {
    it(`${name}：強力游標推擠下繩長維持在靜止長度 ±3%，兩端等於錨點`, () => {
      const r = makeRope(cfg);
      const restTotal = r.rest * (r.N - 1);
      const base = { dt: 1 / 60, hh: HH, rest: r.rest, a: r.a, b: r.b, radius: r.radius, restMidY: -Infinity };
      let t = 0;
      // 先靜置
      for (let i = 0; i < 180; i++) stepRope(r.pos, r.prev, { ...base, t: (t += 1 / 60), pointer: { x: 0, y: 0, strength: 0 } });
      const mid = r.pos[Math.floor(r.N / 2)];
      // 游標停在中點正上方一點，全力推 4 秒；再從左到右、由上往下掃過
      const steps: { x: number; y: number }[] = [];
      for (let i = 0; i < 240; i++) steps.push({ x: mid.x, y: mid.y + r.radius * 0.2 });
      for (let i = 0; i < 240; i++) steps.push({ x: r.a.x + ((r.b.x - r.a.x) * i) / 240, y: r.a.y - (HH * i) / 240 });
      for (const pt of steps) {
        stepRope(r.pos, r.prev, { ...base, t: (t += 1 / 60), pointer: { ...pt, strength: 1 } });
        expect(r.pos[0]).toEqual(r.a);
        expect(r.pos[r.N - 1]).toEqual(r.b);
        const L = ropeLength(r.pos);
        expect(Math.abs(L / restTotal - 1)).toBeLessThan(0.03);
      }
    });
  }

  it("游標低於靜止中點時推力遞減，往下劃過不會把線拖到下方", () => {
    const run = (restMidY: number) => {
      const r = makeRope(desktop);
      const base = { dt: 1 / 60, hh: HH, rest: r.rest, a: r.a, b: r.b, radius: r.radius, restMidY };
      let t = 0;
      for (let i = 0; i < 180; i++) stepRope(r.pos, r.prev, { ...base, t: (t += 1 / 60), pointer: { x: 0, y: 0, strength: 0 } });
      const k = Math.floor(r.N / 2);
      const x = r.pos[k].x;
      const y0 = r.pos[k].y + r.radius * 0.5;
      let lowest = Infinity;
      // 從線的上方往下劃過到很低的地方
      for (let i = 0; i <= 120; i++) {
        stepRope(r.pos, r.prev, { ...base, t: (t += 1 / 60), pointer: { x, y: y0 - (HH * i) / 120, strength: 1 } });
        lowest = Math.min(lowest, ...r.pos.map((p) => p.y));
      }
      return lowest;
    };
    const r = makeRope(desktop);
    for (let i = 0; i < 180; i++) stepRope(r.pos, r.prev, { dt: 1 / 60, t: i / 60, hh: HH, rest: r.rest, a: r.a, b: r.b, radius: r.radius, restMidY: 0, pointer: { x: 0, y: 0, strength: 0 } });
    const restMidY = r.pos[Math.floor(r.N / 2)].y;
    expect(run(restMidY)).toBeGreaterThan(run(-Infinity));
  });
});

describe("pushScale", () => {
  it("中點以上全力，往下一個半徑內降到 0", () => {
    expect(pushScale(1, 0, 1)).toBe(1);
    expect(pushScale(0, 0, 1)).toBe(1);
    expect(pushScale(-0.5, 0, 1)).toBeCloseTo(0.5);
    expect(pushScale(-2, 0, 1)).toBe(0);
  });
});
