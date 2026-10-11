"use client";

import { useEffect, useRef } from "react";

const CYCLE_MS = 30000; // per-line ripple cycle length (ms) — raise for calmer motion, lower for livelier
const AMPLITUDE_PX = 10; // max per-point ripple displacement (px), layered on top of the shared swell below
const SWELL_CYCLE_MS = 46000; // shared swell cycle (ms) — all lines rise/fall together on this one, slower than the ripple
const SWELL_AMPLITUDE_PX = 16; // shared swell amplitude (px) — the dominant term that makes the stack read as one wave surface

export const LINE_COUNT = 17;
const POINT_COUNT = 6;
const FRAME_INTERVAL_MS = 1000 / 30;

/** The original static Atmosphere bezier formula, parameterized by an optional y-offset per control point. */
export function buildPathD(index: number, offsets: readonly number[] = []): string {
  const o = (point: number) => offsets[point] ?? 0;
  return `M -200 ${70 + index * 24 + o(0)} C 200 ${-220 + index * 26 + o(1)}, 370 ${520 + index * 12 + o(2)}, 810 ${200 + index * 24 + o(3)} S 1370 ${40 + index * 31 + o(4)}, 1850 ${400 + index * 30 + o(5)} L 1850 1200 L -200 1200 Z`;
}

function displacement(t: number, line: number, point: number): number {
  const base = (t * 2 * Math.PI) / CYCLE_MS;
  const ripple = AMPLITUDE_PX * (0.6 * Math.sin(base + line * 0.37 + point * 0.9) + 0.4 * Math.sin(base * 1.9 + line * 0.61 + point * 1.7));
  // No `line` term here on purpose: every line shares this phase, so the whole stack swells
  // and recedes together like one wave surface instead of each line jittering independently.
  const swellBase = (t * 2 * Math.PI) / SWELL_CYCLE_MS;
  const swell = SWELL_AMPLITUDE_PX * Math.sin(swellBase + point * 0.5);
  return ripple + swell;
}

/** Slow organic drift for the Atmosphere contour lines: mutates each path's `d` on a throttled rAF loop (no React re-render per frame). Pauses off-screen and respects prefers-reduced-motion. */
export function useContourDrift() {
  const pathRefs = useRef<Array<SVGPathElement | null>>(Array(LINE_COUNT).fill(null));
  const setPathRef = (index: number) => (el: SVGPathElement | null) => { pathRefs.current[index] = el; };

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    let rafId = 0;
    let lastFrame = 0;

    function tick(now: number) {
      rafId = requestAnimationFrame(tick);
      if (now - lastFrame < FRAME_INTERVAL_MS) return;
      lastFrame = now;
      pathRefs.current.forEach((el, line) => {
        if (!el) return;
        const offsets = Array.from({ length: POINT_COUNT }, (_, point) => displacement(now, line, point));
        el.setAttribute("d", buildPathD(line, offsets));
      });
    }
    function stop() {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = 0;
    }
    function resetStatic() {
      pathRefs.current.forEach((el, line) => el?.setAttribute("d", buildPathD(line)));
    }
    function start() {
      if (media.matches || document.hidden || rafId) return;
      rafId = requestAnimationFrame(tick);
    }
    function handleVisibility() {
      if (document.hidden) stop(); else start();
    }
    function handleMotionChange() {
      stop();
      if (media.matches) resetStatic(); else start();
    }

    if (media.matches) resetStatic(); else start();
    document.addEventListener("visibilitychange", handleVisibility);
    media.addEventListener("change", handleMotionChange);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", handleVisibility);
      media.removeEventListener("change", handleMotionChange);
    };
  }, []);

  return setPathRef;
}
