// 紅線繩索的 verlet 一步（純函式，不依賴 three；thread-scene 傳 Vector3 進來，測試傳一般物件）。

export type Vec3 = { x: number; y: number; z: number };

export type RopeStep = {
  dt: number;
  /** 模擬時間（秒），決定呼吸波的相位 */
  t: number;
  /** 可見範圍的半高（世界單位），重力與呼吸波都以它為尺度 */
  hh: number;
  /** 相鄰兩點的靜止距離 */
  rest: number;
  /** 兩端錨點（這一步結束時 pos[0]、pos[N-1] 會等於它們） */
  a: Vec3;
  b: Vec3;
  /** 游標（世界座標）；strength 0..1，0 表示沒有游標 */
  pointer: { x: number; y: number; strength: number };
  /** 游標影響半徑（世界單位） */
  radius: number;
  /** 繩子靜止時中點的 y：游標低於它時推力遞減，往下劃過不會把線拖進下方的標題 */
  restMidY: number;
};

const ITERATIONS = 20;

/** 游標低於靜止中點時的推力倍率：中點以上 1，往下一個半徑內線性降到 0。 */
export function pushScale(pointerY: number, restMidY: number, radius: number): number {
  if (pointerY >= restMidY) return 1;
  return Math.max(0, 1 - (restMidY - pointerY) / Math.max(1e-6, radius));
}

/** 就地更新 pos／prev（兩端固定在 a、b）。 */
export function stepRope(pos: Vec3[], prev: Vec3[], s: RopeStep): void {
  const N = pos.length;
  const g = -0.9 * s.hh; // 重力要夠，多出來的長度才會垂成柔順的弧
  const dt2 = s.dt * s.dt;
  const t = s.t;
  const scale = s.pointer.strength > 0.01 ? s.pointer.strength * pushScale(s.pointer.y, s.restMidY, s.radius) : 0;
  for (let i = 1; i < N - 1; i++) {
    const p = pos[i];
    const q = prev[i];
    const u = i / (N - 1);
    const env = Math.sin(u * Math.PI);
    // 呼吸：低頻的風加一道緩慢移動的 S 形波，線像絲一樣有起伏，不會完全停下
    const wave = Math.sin(u * Math.PI * 2 + t * 0.32) * 0.75 + Math.sin(t * 0.55 + u * 3.1) * 0.3;
    const wy = wave * 0.45 * s.hh * env;
    const wz = Math.sin(t * 0.4 + u * 3.7 + 1.3) * 0.25 * s.hh * env;
    const vx = (p.x - q.x) * 0.985;
    const vy = (p.y - q.y) * 0.985;
    const vz = (p.z - q.z) * 0.985;
    q.x = p.x;
    q.y = p.y;
    q.z = p.z;
    p.x += vx;
    p.y += vy + (g + wy) * dt2;
    p.z += vz + wz * dt2;
    // 游標輕推：越靠近推得越多（平方衰減），每步只推一點，靠繩長約束與重力拉回
    if (scale > 0) {
      const dx = p.x - s.pointer.x;
      const dy = p.y - s.pointer.y;
      const d = Math.hypot(dx, dy);
      if (d < s.radius && d > 1e-5) {
        const f = (s.radius - d) / s.radius;
        const push = f * f * 0.022 * scale * s.radius;
        p.x += (dx / d) * push;
        p.y += (dy / d) * push;
      }
    }
  }
  setV(pos[0], s.a);
  setV(pos[N - 1], s.b);
  // 約束多解幾次：次數太少時繩子會被重力與游標拉長，看起來像橡皮筋
  for (let it = 0; it < ITERATIONS; it++) {
    for (let i = 0; i < N - 1; i++) {
      const a = pos[i];
      const b = pos[i + 1];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dz = b.z - a.z;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6;
      const diff = (d - s.rest) / d;
      const wa = i === 0 ? 0 : i + 1 === N - 1 ? 1 : 0.5;
      const wb = i === 0 ? 1 : i + 1 === N - 1 ? 0 : 0.5;
      a.x += dx * diff * wa;
      a.y += dy * diff * wa;
      a.z += dz * diff * wa;
      b.x -= dx * diff * wb;
      b.y -= dy * diff * wb;
      b.z -= dz * diff * wb;
    }
  }
  // 彎曲剛性：輕微平滑，讓多出來的長度變成柔順的弧，而不是小折角
  for (let i = 1; i < N - 1; i++) {
    const p = pos[i];
    p.x += ((pos[i - 1].x + pos[i + 1].x) * 0.5 - p.x) * 0.08;
    p.y += ((pos[i - 1].y + pos[i + 1].y) * 0.5 - p.y) * 0.08;
    p.z += ((pos[i - 1].z + pos[i + 1].z) * 0.5 - p.z) * 0.08;
  }
}

function setV(o: Vec3, v: Vec3) {
  o.x = v.x;
  o.y = v.y;
  o.z = v.z;
}

/** 折線總長（測試與除錯用）。 */
export function ropeLength(pos: Vec3[]): number {
  let L = 0;
  for (let i = 0; i < pos.length - 1; i++) L += Math.hypot(pos[i + 1].x - pos[i].x, pos[i + 1].y - pos[i].y, pos[i + 1].z - pos[i].z);
  return L;
}
