// 「紅線」three.js 場景：一條 verlet 繩索的紅線，兩端各繫一個結（品牌、創作者）。
// 只用 three 的具名 import（不用 addons、後製、Worker、eval），由 ThreadCanvas 以 dynamic import 載入。
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CatmullRomCurve3,
  Color,
  DoubleSide,
  Group,
  Line,
  LineBasicMaterial,
  Mesh,
  NormalBlending,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  TorusKnotGeometry,
  Vector3,
  WebGLRenderer,
} from "three";

import type { ThreadVariant } from "./types";

export type { ThreadVariant };
export type ThreadPalette = { bg: string; thread: string; glow: string; knot: string; far: string; light: boolean };
export type ThreadSceneOptions = {
  variant: ThreadVariant;
  palette: ThreadPalette;
  reducedMotion: boolean;
  mobile: boolean;
  /** 「牽線」開場（只有 hero 會用；預設 true）。換斷點重建場景時傳 false，不重播。 */
  intro?: boolean;
  onFirstFrame?: () => void;
};
export type ThreadPull = "brand" | "creator" | null;
export type ThreadSceneHandle = {
  setPointer(x: number | null, y: number | null): void;
  setPull(side: ThreadPull): void;
  setPalette(p: ThreadPalette): void;
  resize(width: number, height: number): void;
  start(): void;
  stop(): void;
  dispose(): void;
};

type Tuning = {
  points: number;
  tubular: number;
  radial: number;
  radiusPx: number; // 線的半徑（CSS px）
  knotPx: number; // 結的大小（CSS px）
  slack: number; // 繩長 ÷ 兩端距離
  far: number; // 遠景細線數
  dprCap: number;
  glowAlpha: number;
};

function tuningFor(variant: ThreadVariant, mobile: boolean): Tuning {
  if (variant === "hero") {
    return mobile
      ? { points: 32, tubular: 96, radial: 6, radiusPx: 1.8, knotPx: 8, slack: 1.24, far: 5, dprCap: 1.5, glowAlpha: 0.42 }
      : { points: 48, tubular: 160, radial: 8, radiusPx: 2.3, knotPx: 11, slack: 1.08, far: 8, dprCap: 2, glowAlpha: 0.42 };
  }
  if (variant === "quiet") {
    return { points: 28, tubular: mobile ? 80 : 112, radial: 6, radiusPx: 1.6, knotPx: 8, slack: mobile ? 1.05 : 1.1, far: mobile ? 0 : 4, dprCap: 1.5, glowAlpha: 0.24 };
  }
  return { points: 20, tubular: mobile ? 72 : 120, radial: 6, radiusPx: 1.2, knotPx: 6, slack: 1.025, far: 0, dprCap: 1.5, glowAlpha: 0.22 };
}

// 結與兩端位置（以可見範圍的半寬 hw、半高 hh 的比例表示）
type Anchors = { a: [number, number, number]; b: [number, number, number] };

function anchorsFor(variant: ThreadVariant, aspect: number): Anchors {
  if (variant === "ribbon") return { a: [-0.86, 0.2, 0], b: [0.86, -0.05, 0] };
  if (variant === "quiet") {
    if (aspect > 1.6) return { a: [-0.86, 0.18, 0.2], b: [0.86, -0.1, -0.3] }; // 手機上方的橫帶
    return { a: [-0.62, 0.62, 0.3], b: [0.58, -0.42, -0.4] };
  }
  if (aspect < 1) return { a: [-0.76, 0.6, 0.3], b: [0.76, 0.2, -0.4] }; // 手機直式：線在上方 55%
  return { a: [-0.68, 0.46, 0.5], b: [0.8, 0.2, -0.7] };
}

// 可重現的亂數（遠景細線形狀固定）
function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const easeOutCubic = (x: number) => 1 - Math.pow(1 - x, 3);
const easeOutBack = (x: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
};
const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

const TUBE_VERT = /* glsl */ `
attribute float aV;
attribute float aA;
varying float vV;
varying float vA;
varying vec3 vN;
varying vec3 vView;
void main() {
  vV = aV;
  vA = aA;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vView = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;

// 主線：中心略亮、細的絲光高光、牽線時前端發亮
const CORE_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uProgress;
uniform float uLight;
uniform float uTwist;
uniform float uGlint;
varying float vV;
varying float vA;
varying vec3 vN;
varying vec3 vView;
void main() {
  if (vV > uProgress) discard;
  vec3 n = normalize(vN);
  float facing = abs(dot(n, normalize(vView)));
  vec3 c = uColor * (0.78 + 0.3 * facing);
  // 兩股絲線扭在一起的紋理（像真的紅繩）
  float twist = 0.5 + 0.5 * sin((vV * uTwist + vA) * 12.566);
  c *= 0.86 + 0.14 * twist;
  float sheen = pow(max(dot(n, normalize(vec3(-0.35, 0.65, 0.7))), 0.0), 14.0);
  c += vec3(1.0, 0.9, 0.86) * sheen * mix(0.45, 0.22, uLight);
  // 偶爾有一道微光沿線從品牌端走到創作者端（像訊息傳過去）
  float gd = (vV - uGlint) * 14.0;
  c = mix(c, vec3(1.0, 0.86, 0.8), exp(-gd * gd) * 0.32);
  float tip = smoothstep(uProgress - 0.05, uProgress, vV) * step(uProgress, 0.999);
  c = mix(c, vec3(1.0, 0.88, 0.82), tip * 0.7);
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}`;

// 光暈：較粗的管子，正面最亮、邊緣淡出（不用後製）
const GLOW_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uAlpha;
uniform float uProgress;
uniform float uGlint;
varying float vV;
varying vec3 vN;
varying vec3 vView;
void main() {
  if (vV > uProgress) discard;
  float facing = abs(dot(normalize(vN), normalize(vView)));
  float gd = (vV - uGlint) * 10.0;
  float a = pow(facing, 2.0) * uAlpha * (1.0 + 0.9 * exp(-gd * gd));
  gl_FragColor = vec4(uColor, a);
  #include <colorspace_fragment>
}`;

const KNOT_VERT = /* glsl */ `
varying vec3 vN;
varying vec3 vView;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vView = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;

const KNOT_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uLight;
varying vec3 vN;
varying vec3 vView;
void main() {
  vec3 n = normalize(vN);
  float facing = abs(dot(n, normalize(vView)));
  vec3 c = uColor * (0.62 + 0.45 * facing);
  float sheen = pow(max(dot(n, normalize(vec3(-0.35, 0.65, 0.7))), 0.0), 10.0);
  c += vec3(1.0, 0.92, 0.88) * sheen * mix(0.5, 0.28, uLight);
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}`;

const HALO_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const HALO_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uAlpha;
varying vec2 vUv;
void main() {
  float d = length(vUv - 0.5) * 2.0;
  float a = exp(-d * d * 5.5) * (1.0 - smoothstep(0.75, 1.0, d)) * uAlpha;
  gl_FragColor = vec4(uColor, a);
  #include <colorspace_fragment>
}`;

/** 管狀幾何：預先配置好陣列，每一幀就地改寫位置與法線。 */
class TubeBuffer {
  readonly geometry = new BufferGeometry();
  readonly positions: Float32Array;
  readonly normals: Float32Array;
  constructor(readonly tubular: number, readonly radial: number) {
    const rings = tubular + 1;
    this.positions = new Float32Array(rings * radial * 3);
    this.normals = new Float32Array(rings * radial * 3);
    const v = new Float32Array(rings * radial);
    const ang = new Float32Array(rings * radial);
    for (let j = 0; j < rings; j++) {
      for (let k = 0; k < radial; k++) {
        v[j * radial + k] = j / tubular;
        ang[j * radial + k] = k / radial;
      }
    }
    const index: number[] = [];
    for (let j = 0; j < tubular; j++) {
      for (let k = 0; k < radial; k++) {
        const a = j * radial + k;
        const b = (j + 1) * radial + k;
        const c = (j + 1) * radial + ((k + 1) % radial);
        const d = j * radial + ((k + 1) % radial);
        index.push(a, b, d, b, c, d);
      }
    }
    this.geometry.setIndex(index);
    this.geometry.setAttribute("position", new BufferAttribute(this.positions, 3));
    this.geometry.setAttribute("normal", new BufferAttribute(this.normals, 3));
    this.geometry.setAttribute("aV", new BufferAttribute(v, 1));
    this.geometry.setAttribute("aA", new BufferAttribute(ang, 1));
  }
  commit() {
    (this.geometry.getAttribute("position") as BufferAttribute).needsUpdate = true;
    (this.geometry.getAttribute("normal") as BufferAttribute).needsUpdate = true;
  }
}

export function createThreadScene(canvas: HTMLCanvasElement, opts: ThreadSceneOptions): ThreadSceneHandle {
  const { variant, mobile, reducedMotion } = opts;
  const tune = tuningFor(variant, mobile);
  const deviceDpr = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
  const dpr = Math.min(deviceDpr, tune.dprCap);

  const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: dpr < 2, powerPreference: "low-power" });
  renderer.setPixelRatio(dpr);
  renderer.setClearColor(0x000000, 0);

  const scene = new Scene();
  const camera = new PerspectiveCamera(35, 1, 0.1, 60);
  camera.position.set(0, 0, 10);

  // ---- 材質 ----
  const coreMat = new ShaderMaterial({
    vertexShader: TUBE_VERT,
    fragmentShader: CORE_FRAG,
    uniforms: { uColor: { value: new Color() }, uProgress: { value: reducedMotion ? 1 : 0 }, uLight: { value: 0 }, uTwist: { value: 120 }, uGlint: { value: -1 } },
  });
  const glowMat = new ShaderMaterial({
    vertexShader: TUBE_VERT,
    fragmentShader: GLOW_FRAG,
    uniforms: { uColor: { value: new Color() }, uAlpha: { value: tune.glowAlpha }, uProgress: { value: reducedMotion ? 1 : 0 }, uGlint: { value: -1 } },
    transparent: true,
    depthWrite: false,
  });
  const knotMat = new ShaderMaterial({
    vertexShader: KNOT_VERT,
    fragmentShader: KNOT_FRAG,
    uniforms: { uColor: { value: new Color() }, uLight: { value: 0 } },
  });
  const haloMats = [0, 1].map(
    () =>
      new ShaderMaterial({
        vertexShader: HALO_VERT,
        fragmentShader: HALO_FRAG,
        uniforms: { uColor: { value: new Color() }, uAlpha: { value: 0 } },
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
      }),
  );
  const farMat = new LineBasicMaterial({ transparent: true, opacity: 0.6, depthWrite: false });

  // ---- 紅線 ----
  const core = new TubeBuffer(tune.tubular, tune.radial);
  const glow = new TubeBuffer(tune.tubular, tune.radial);
  const coreMesh = new Mesh(core.geometry, coreMat);
  const glowMesh = new Mesh(glow.geometry, glowMat);
  coreMesh.frustumCulled = false;
  glowMesh.frustumCulled = false;
  glowMesh.renderOrder = 2;
  scene.add(glowMesh, coreMesh);

  // ---- 兩個結（三葉結）與光暈 ----
  const knotGeo = new TorusKnotGeometry(1, 0.32, 64, 8, 2, 3);
  const haloGeo = new PlaneGeometry(1, 1);
  const knots = [0, 1].map((i) => {
    const g = new Group();
    const m = new Mesh(knotGeo, knotMat);
    m.rotation.set(0.5, i === 0 ? 0.6 : -0.6, 0);
    const h = new Mesh(haloGeo, haloMats[i]);
    h.renderOrder = 3;
    g.add(h, m);
    scene.add(g);
    return { group: g, mesh: m, halo: h };
  });

  // ---- 遠景細線（其他正在發生的媒合）----
  const farGroup = new Group();
  const farGeos: BufferGeometry[] = [];
  const rand = mulberry32(20261127);
  const farPhase: number[] = [];
  for (let i = 0; i < tune.far; i++) {
    const z = -6 - rand() * 6;
    const spanY = 3.2 + (-z) * 0.32;
    const spanX = spanY * 2.2;
    const y0 = (rand() * 2 - 1) * spanY * 0.9;
    const pts: Vector3[] = [];
    const n = 4;
    for (let k = 0; k < n; k++) {
      const s = k / (n - 1);
      pts.push(new Vector3(-spanX + s * spanX * 2, y0 + (rand() * 2 - 1) * spanY * 0.35 - Math.sin(s * Math.PI) * spanY * 0.15, z + (rand() - 0.5)));
    }
    const curve = new CatmullRomCurve3(pts, false, "centripetal");
    const geo = new BufferGeometry().setFromPoints(curve.getPoints(80));
    farGeos.push(geo);
    const line = new Line(geo, farMat);
    line.renderOrder = 0;
    farPhase.push(rand() * Math.PI * 2);
    farGroup.add(line);
  }
  scene.add(farGroup);

  // ---- 繩索（verlet）----
  const N = tune.points;
  const pos = Array.from({ length: N }, () => new Vector3());
  const prev = Array.from({ length: N }, () => new Vector3());
  const curve = new CatmullRomCurve3(pos, false, "centripetal");
  let restLen = 0.1;
  let hw = 1;
  let hh = 1;
  let unitsPerPx = 0.01;
  let initialized = false;
  const anchorBase = { a: new Vector3(), b: new Vector3() };
  const anchorNow = { a: new Vector3(), b: new Vector3() };
  const mid = new Vector3();

  // 互動狀態
  const pointer = { x: 0, y: 0, active: false, sx: 0, sy: 0, strength: 0 };
  let pullTarget: ThreadPull = null;
  const pullAmt = { brand: 0, creator: 0 };
  let palette = opts.palette;

  // 時間
  let raf = 0;
  let running = false;
  let disposed = false;
  let firstFrameSent = false;
  let simTime = 0;
  let introStart = -1;
  let last = 0;
  let acc = 0;
  const STEP = 1 / 60;

  function applyPalette(p: ThreadPalette) {
    palette = p;
    coreMat.uniforms.uColor.value.set(p.thread);
    coreMat.uniforms.uLight.value = p.light ? 1 : 0;
    knotMat.uniforms.uColor.value.set(p.knot);
    knotMat.uniforms.uLight.value = p.light ? 1 : 0;
    glowMat.uniforms.uColor.value.set(p.glow);
    // 淺色底用一般混合（加法混合在淺底會洗白）
    glowMat.blending = p.light ? NormalBlending : AdditiveBlending;
    glowMat.uniforms.uAlpha.value = p.light ? tune.glowAlpha * 0.55 : tune.glowAlpha;
    for (const m of haloMats) {
      m.uniforms.uColor.value.set(p.glow);
      m.blending = p.light ? NormalBlending : AdditiveBlending;
    }
    farMat.color.set(p.far);
    farMat.opacity = p.light ? 0.6 : 0.55;
  }
  applyPalette(opts.palette);

  function layout(width: number, height: number) {
    const aspect = width / Math.max(1, height);
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    hh = camera.position.z * Math.tan((camera.fov * Math.PI) / 360);
    hw = hh * aspect;
    unitsPerPx = (2 * hh) / Math.max(1, height);
    const an = anchorsFor(variant, aspect);
    anchorBase.a.set(an.a[0] * hw, an.a[1] * hh, an.a[2]);
    anchorBase.b.set(an.b[0] * hw, an.b[1] * hh, an.b[2]);
    const dist = anchorBase.a.distanceTo(anchorBase.b);
    restLen = (dist * tune.slack) / (N - 1);
    const ks = tune.knotPx * unitsPerPx;
    for (const k of knots) {
      k.mesh.scale.setScalar(ks);
      k.halo.scale.setScalar(ks * 12);
    }
    if (!initialized) {
      // 初始形狀：兩端之間略為下垂的弧
      const sag = dist * Math.sqrt(Math.max(0, tune.slack - 1)) * 0.55;
      for (let i = 0; i < N; i++) {
        const s = i / (N - 1);
        pos[i].lerpVectors(anchorBase.a, anchorBase.b, s);
        pos[i].y -= sag * 4 * s * (1 - s);
        prev[i].copy(pos[i]);
      }
      anchorNow.a.copy(anchorBase.a);
      anchorNow.b.copy(anchorBase.b);
      initialized = true;
      // 先在背後模擬 3 秒讓繩子靜下來：開場畫的是已經垂好的線，不是還在甩動的線
      simTime = -3;
      for (let i = 0; i < 180; i++) step(STEP);
      simTime = 0;
    }
  }

  function step(dt: number) {
    simTime += dt;
    // 拉力：滑到 CTA 時往該端收緊（約 300ms 緩動）
    const k = 1 - Math.exp(-dt / 0.1);
    pullAmt.brand += ((pullTarget === "brand" ? 1 : 0) - pullAmt.brand) * k;
    pullAmt.creator += ((pullTarget === "creator" ? 1 : 0) - pullAmt.creator) * k;
    mid.lerpVectors(anchorBase.a, anchorBase.b, 0.5);
    anchorNow.a.lerpVectors(anchorBase.a, mid, 0.12 * pullAmt.brand);
    anchorNow.b.lerpVectors(anchorBase.b, mid, 0.12 * pullAmt.creator);
    const rest = restLen * (1 - 0.08 * Math.max(pullAmt.brand, pullAmt.creator));

    // 游標位置平滑
    pointer.strength += ((pointer.active ? 1 : 0) - pointer.strength) * (1 - Math.exp(-dt / 0.25));
    pointer.sx += (pointer.x * hw - pointer.sx) * (1 - Math.exp(-dt / 0.08));
    pointer.sy += (pointer.y * hh - pointer.sy) * (1 - Math.exp(-dt / 0.08));
    const radius = (mobile ? 90 : 140) * unitsPerPx;

    const g = -0.9 * hh; // 重力要夠，多出來的長度才會垂成柔順的弧
    const dt2 = dt * dt;
    const t = simTime;
    for (let i = 1; i < N - 1; i++) {
      const p = pos[i];
      const q = prev[i];
      const s = i / (N - 1);
      const env = Math.sin(s * Math.PI);
      // 呼吸：低頻的風，線不會完全停下
      // 加一道緩慢移動的 S 形波，讓線像絲一樣有起伏，而不是一條單純的下垂弧線
      const wave = Math.sin(s * Math.PI * 2 + t * 0.32) * 0.75 + Math.sin(t * 0.55 + s * 3.1) * 0.3;
      const wy = wave * 0.45 * hh * env;
      const wz = Math.sin(t * 0.4 + s * 3.7 + 1.3) * 0.25 * hh * env;
      const vx = (p.x - q.x) * 0.985;
      const vy = (p.y - q.y) * 0.985;
      const vz = (p.z - q.z) * 0.985;
      q.copy(p);
      p.x += vx;
      p.y += vy + (g + wy) * dt2;
      p.z += vz + wz * dt2;
      // 游標輕推：越靠近推得越多（平方衰減），每步只推一點，靠繩長約束與重力拉回，不會瞬間跳開或被拉長
      if (pointer.strength > 0.01) {
        const dx = p.x - pointer.sx;
        const dy = p.y - pointer.sy;
        const d = Math.hypot(dx, dy);
        if (d < radius && d > 1e-5) {
          const f = (radius - d) / radius;
          const push = f * f * 0.022 * pointer.strength * radius;
          p.x += (dx / d) * push;
          p.y += (dy / d) * push;
        }
      }
    }
    pos[0].copy(anchorNow.a);
    pos[N - 1].copy(anchorNow.b);
    // 約束解 8 次：次數太少時繩子會被重力與游標拉長，看起來像橡皮筋
    for (let it = 0; it < 8; it++) {
      for (let i = 0; i < N - 1; i++) {
        const a = pos[i];
        const b = pos[i + 1];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dz = b.z - a.z;
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6;
        const diff = (d - rest) / d;
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

  const samples: Vector3[] = Array.from({ length: tune.tubular + 1 }, () => new Vector3());
  const tan = new Vector3();
  const nor = new Vector3();
  const bin = new Vector3();
  const Z = new Vector3(0, 0, 1);

  function rebuildTube() {
    const T = tune.tubular;
    const R = tune.radial;
    for (let j = 0; j <= T; j++) curve.getPoint(j / T, samples[j]);
    const base = tune.radiusPx * unitsPerPx;
    for (let j = 0; j <= T; j++) {
      const v = j / T;
      const a = samples[Math.max(0, j - 1)];
      const b = samples[Math.min(T, j + 1)];
      tan.subVectors(b, a).normalize();
      nor.crossVectors(tan, Z);
      if (nor.lengthSq() < 1e-8) nor.set(0, 1, 0);
      nor.normalize();
      bin.crossVectors(tan, nor).normalize();
      // 粗細：±15% 的起伏，靠近兩端略收細
      const vary = 1 + 0.15 * Math.sin(v * 23 + 1.7) * Math.sin(v * 7.1 + 0.4);
      const taper = 0.7 + 0.3 * smooth(0, 0.06, v) * smooth(1, 0.94, v);
      const r = base * vary * taper;
      const c = samples[j];
      for (let k = 0; k < R; k++) {
        const ang = (k / R) * Math.PI * 2;
        const cs = Math.cos(ang);
        const sn = Math.sin(ang);
        const nx = nor.x * cs + bin.x * sn;
        const ny = nor.y * cs + bin.y * sn;
        const nz = nor.z * cs + bin.z * sn;
        const o = (j * R + k) * 3;
        core.normals[o] = nx;
        core.normals[o + 1] = ny;
        core.normals[o + 2] = nz;
        glow.normals[o] = nx;
        glow.normals[o + 1] = ny;
        glow.normals[o + 2] = nz;
        core.positions[o] = c.x + nx * r;
        core.positions[o + 1] = c.y + ny * r;
        core.positions[o + 2] = c.z + nz * r;
        const rg = r * 3.6;
        glow.positions[o] = c.x + nx * rg;
        glow.positions[o + 1] = c.y + ny * rg;
        glow.positions[o + 2] = c.z + nz * rg;
      }
    }
    core.commit();
    glow.commit();
  }

  function updateDecor(now: number) {
    // 牽線：約 1.2 秒從品牌端畫到創作者端
    // 只有首頁（hero）有開場；登入頁與公開頁的線一開始就在（規格 §6.4）
    const intro = !reducedMotion && variant === "hero" && opts.intro !== false;
    let progress = 1;
    if (intro) {
      if (introStart < 0) introStart = now;
      progress = easeOutCubic(Math.min(1, (now - introStart) / 1200));
    }
    coreMat.uniforms.uProgress.value = progress;
    glowMat.uniforms.uProgress.value = progress;

    knots[0].group.position.copy(pos[0]);
    knots[1].group.position.copy(pos[N - 1]);
    // 創作者端的結在線牽到時才出現（彈一下）
    const popT = !intro ? 1 : Math.min(1, Math.max(0, (now - introStart - 1080) / 320));
    knots[1].group.scale.setScalar(popT <= 0 ? 0.0001 : easeOutBack(popT));
    const breath = reducedMotion ? 0 : Math.sin(simTime * 1.3) * 0.08;
    const baseHalo = palette.light ? 0.22 : 0.42;
    haloMats[0].uniforms.uAlpha.value = baseHalo * (1 + breath + 0.6 * pullAmt.brand);
    // 微光：開場後每 9 秒一次、2.6 秒走完全程；到達時創作者端的結微微亮一下
    let glint = -1;
    if (!reducedMotion) {
      const gt = (simTime - 4) % 9;
      if (simTime >= 4 && gt < 2.6) glint = smooth(0, 1, gt / 2.6) * 1.3 - 0.15;
    }
    coreMat.uniforms.uGlint.value = glint;
    glowMat.uniforms.uGlint.value = glint;
    const arrive = glint < 0 ? 0 : Math.exp(-Math.pow((glint - 1) * 7, 2)) * 0.45;
    const flash = popT > 0 && popT < 1 ? (1 - popT) * 0.8 : 0;
    haloMats[1].uniforms.uAlpha.value = baseHalo * (1 - breath + 0.6 * pullAmt.creator + flash + arrive) * (popT > 0 ? 1 : 0);
    if (!reducedMotion) {
      knots[0].mesh.rotation.z = simTime * 0.25;
      knots[1].mesh.rotation.z = -simTime * 0.25;
      farGroup.children.forEach((c, i) => {
        c.position.y = Math.sin(simTime * 0.05 + farPhase[i]) * 0.25;
        c.position.x = Math.sin(simTime * 0.03 + farPhase[i] * 1.7) * 0.4;
      });
    }
  }

  function render(now: number) {
    rebuildTube();
    updateDecor(now);
    renderer.render(scene, camera);
    if (!firstFrameSent) {
      firstFrameSent = true;
      opts.onFirstFrame?.();
    }
  }

  // reduced motion：先在背後模擬到靜止，只畫一張
  function renderStatic() {
    if (disposed || !initialized) return;
    for (let i = 0; i < 240; i++) step(STEP);
    render(0);
  }

  function frame(now: number) {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    acc += dt;
    let n = 0;
    while (acc >= STEP && n < 3) {
      step(STEP);
      acc -= STEP;
      n++;
    }
    if (n === 3) acc = 0;
    render(now);
  }

  return {
    setPointer(x, y) {
      if (x === null || y === null) {
        pointer.active = false;
        return;
      }
      pointer.x = x;
      pointer.y = y;
      pointer.active = true;
    },
    setPull(side) {
      pullTarget = side;
      if (reducedMotion) {
        pullAmt.brand = side === "brand" ? 1 : 0;
        pullAmt.creator = side === "creator" ? 1 : 0;
        renderStatic();
      }
    },
    setPalette(p) {
      applyPalette(p);
      if (reducedMotion) renderStatic();
    },
    resize(width, height) {
      renderer.setSize(width, height, false);
      layout(width, height);
      if (reducedMotion) renderStatic();
    },
    start() {
      if (disposed || running) return;
      if (reducedMotion) {
        renderStatic();
        return;
      }
      running = true;
      last = performance.now();
      acc = 0;
      raf = requestAnimationFrame(frame);
    },
    stop() {
      running = false;
      cancelAnimationFrame(raf);
    },
    dispose() {
      running = false;
      disposed = true;
      cancelAnimationFrame(raf);
      core.geometry.dispose();
      glow.geometry.dispose();
      knotGeo.dispose();
      haloGeo.dispose();
      farGeos.forEach((g) => g.dispose());
      [coreMat, glowMat, knotMat, farMat, ...haloMats].forEach((m) => m.dispose());
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
