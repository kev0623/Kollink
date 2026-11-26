"use client";

import { useEffect, useRef, useState } from "react";
import { ThreadFallback } from "./ThreadFallback";
import { normalizePointer, readPalette, shouldLoadScene } from "./palette";
import type { ThreadVariant } from "./types";

type Props = { variant: ThreadVariant };

type NavigatorExtra = Navigator & { connection?: { saveData?: boolean }; deviceMemory?: number };

const MOBILE_QUERY = "(max-width: 767px)";

/** three 0.187 只支援 WebGL2：先用一張丟棄的 canvas 試，失敗就不下載 three（也不會有 three 的錯誤訊息）。 */
function hasWebGL2(): boolean {
  try {
    const gl = document.createElement("canvas").getContext("webgl2");
    if (!gl) return false;
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}

/**
 * 紅線場景的包裝（規格 §6.3）：
 * - SVG 後備一開始就在（伺服器輸出的 HTML 就有）；canvas 第一幀畫完才淡入，同時把 SVG 淡出（兩者疊在同一個 absolute 容器裡，不影響版面）。
 * - three 在 idle 後才 dynamic import（只有掛了這個元件的頁面會下載）；reduced motion、省流量、低階裝置、沒有 WebGL2、context 遺失時一直是 SVG。
 * - 分頁隱藏或捲出畫面時停止 rAF；換主題時即時換色；跨過手機／桌面斷點時重建（不重播開場）；卸載時 dispose。
 */
export function ThreadCanvas({ variant }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const nav = navigator as NavigatorExtra;
    const env = {
      reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      saveData: nav.connection?.saveData === true,
      cores: nav.hardwareConcurrency,
      memory: nav.deviceMemory,
    };
    if (!shouldLoadScene(env)) return;
    // ribbon 只在桌面、滑鼠裝置用 WebGL（規格 §6.4）
    if (variant === "ribbon" && !window.matchMedia("(min-width: 768px) and (pointer: fine)").matches) return;

    let disposed = false;
    let gen = 0; // 每次 boot 的代號：較舊的 boot 在 await 之後發現代號變了就放棄
    let teardown: (() => void) | null = null;
    const mobileMq = window.matchMedia(MOBILE_QUERY);

    async function boot(intro: boolean) {
      const my = ++gen;
      if (!hasWebGL2()) return;
      const mod = await import("./thread-scene");
      if (disposed || my !== gen || !host) return;
      // 每次建一張新的 canvas：dispose 會 forceContextLoss，舊 canvas 的 context 不能再用
      const canvas = document.createElement("canvas");
      canvas.className = "absolute inset-0 h-full w-full";
      host.appendChild(canvas);
      const root = document.documentElement;
      const palette = () => readPalette(getComputedStyle(root), root.getAttribute("data-theme"));
      let handle: ReturnType<typeof mod.createThreadScene>;
      try {
        handle = mod.createThreadScene(canvas, {
          variant,
          palette: palette(),
          reducedMotion: false,
          mobile: mobileMq.matches,
          intro,
          onFirstFrame: () => {
            if (!disposed) setReady(true);
          },
        });
      } catch {
        canvas.remove();
        return; // 建不起 WebGL：維持 SVG
      }
      const cleanups: (() => void)[] = [() => canvas.remove(), () => handle.dispose()];
      teardown = () => {
        cleanups.reverse().forEach((f) => f());
        cleanups.length = 0;
      };

      const box = host;
      const ro = new ResizeObserver(([e]) => handle.resize(e.contentRect.width, e.contentRect.height));
      ro.observe(box);
      cleanups.push(() => ro.disconnect());

      let onScreen = true;
      const sync = () => (onScreen && !document.hidden ? handle.start() : handle.stop());
      const io = new IntersectionObserver(([e]) => {
        onScreen = e.isIntersecting;
        sync();
      });
      io.observe(box);
      cleanups.push(() => io.disconnect());
      document.addEventListener("visibilitychange", sync);
      cleanups.push(() => document.removeEventListener("visibilitychange", sync));

      const mo = new MutationObserver(() => handle.setPalette(palette()));
      mo.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
      cleanups.push(() => mo.disconnect());

      // context 遺失（GPU 重置、分頁太多）：停下來、退回 SVG，不再重建
      const lost = () => {
        handle.stop();
        setReady(false);
      };
      canvas.addEventListener("webglcontextlost", lost);
      cleanups.push(() => canvas.removeEventListener("webglcontextlost", lost));

      if (variant === "hero") {
        // 游標只跟滑鼠（觸控捲動時不拉線）
        const move = (e: PointerEvent) => {
          if (e.pointerType !== "mouse") return;
          const p = normalizePointer(e.clientX, e.clientY, canvas.getBoundingClientRect());
          handle.setPointer(p ? p[0] : null, p ? p[1] : null);
        };
        const leave = () => handle.setPointer(null, null);
        window.addEventListener("pointermove", move, { passive: true });
        root.addEventListener("pointerleave", leave);
        window.addEventListener("blur", leave);
        cleanups.push(() => {
          window.removeEventListener("pointermove", move);
          root.removeEventListener("pointerleave", leave);
          window.removeEventListener("blur", leave);
        });

        // 入口按鈕張力：滑過或聚焦 [data-thread-pull]
        const sideOf = (t: EventTarget | null) => {
          const el = t instanceof Element ? t.closest<HTMLElement>("[data-thread-pull]") : null;
          const v = el?.dataset.threadPull;
          return v === "brand" || v === "creator" ? v : null;
        };
        const enter = (e: Event) => {
          const s = sideOf(e.target);
          if (s) handle.setPull(s);
        };
        const exit = (e: Event) => {
          const next = (e as PointerEvent | FocusEvent).relatedTarget;
          if (sideOf(e.target) && sideOf(next) !== sideOf(e.target)) handle.setPull(sideOf(next));
        };
        document.addEventListener("pointerover", enter);
        document.addEventListener("pointerout", exit);
        document.addEventListener("focusin", enter);
        document.addEventListener("focusout", exit);
        cleanups.push(() => {
          document.removeEventListener("pointerover", enter);
          document.removeEventListener("pointerout", exit);
          document.removeEventListener("focusin", enter);
          document.removeEventListener("focusout", exit);
        });
      }
      handle.resize(box.clientWidth, box.clientHeight);
      sync();
    }

    // 跨過斷點：手機與桌面的構圖、點數不同，重建一次（不重播開場；新 canvas 第一幀前先顯示 SVG）
    const onBreakpoint = () => {
      if (!teardown) return; // 還沒建好（或沒有 WebGL）：第一次 boot 會讀到新的斷點
      teardown();
      teardown = null;
      setReady(false);
      void boot(false);
    };
    mobileMq.addEventListener("change", onBreakpoint);

    const run = () => {
      void boot(true);
    };
    // Safari 沒有 requestIdleCallback：退回 setTimeout 200ms（規格 §12）
    const hasIdle = "requestIdleCallback" in window;
    const idle = hasIdle ? window.requestIdleCallback(run, { timeout: 1500 }) : window.setTimeout(run, 200);
    return () => {
      disposed = true;
      mobileMq.removeEventListener("change", onBreakpoint);
      if (hasIdle) window.cancelIdleCallback(idle);
      else window.clearTimeout(idle);
      teardown?.();
    };
  }, [variant]);

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      <div className={`absolute inset-0 ${ready ? "opacity-0" : "opacity-100 transition-opacity duration-500"}`}>
        <ThreadFallback variant={variant} />
      </div>
      <div ref={hostRef} className={`absolute inset-0 transition-opacity duration-300 ${ready ? "opacity-100" : "opacity-0"}`} />
    </div>
  );
}
