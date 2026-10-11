"use client";

import { LINE_COUNT, buildPathD, useContourDrift } from "./use-contour-drift";

// A few lines, spread through the stack, rendered soft instead of crisp — reads as a diffuse
// glowing wave core sitting among the sharper contour lines, without a video/canvas layer.
const GLOW_LINES = new Set([2, 7, 12]);

/** Lightweight decorative vector contours; drifts slowly via useContourDrift, static when prefers-reduced-motion is set. */
export function Atmosphere() {
  const setPathRef = useContourDrift();
  return <div className="atmosphere" aria-hidden="true"><svg viewBox="0 0 1600 1100" preserveAspectRatio="xMidYMin slice"><defs>
    <linearGradient id="wave-surface" x1="0" y1="0" x2="0.8" y2="1"><stop stopColor="#363940" /><stop offset=".45" stopColor="#14161b" /><stop offset="1" stopColor="#090b0f" /></linearGradient>
    <filter id="wave-glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="16" /></filter>
  </defs>
    {Array.from({ length: LINE_COUNT }, (_, index) => {
      const glow = GLOW_LINES.has(index);
      return <path key={index} ref={setPathRef(index)} d={buildPathD(index)} fill="url(#wave-surface)" stroke="currentColor" strokeWidth={glow ? 0 : 1} filter={glow ? "url(#wave-glow)" : undefined} opacity={glow ? 0.85 : 1} />;
    })}
  </svg></div>;
}
