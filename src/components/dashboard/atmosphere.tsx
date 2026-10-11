"use client";

import { memo, useId } from "react";
import { useAtmosphereAnimation } from "./use-workspace-widgets";

const WAVE_COUNT = 17;
const WAVE_SPACING = 24;
const WAVE_PERIOD = 800;
const TILE_WIDTH = 1600;
const WAVE_SAMPLES = 320;

function wavePoints(index: number, center: number, reverse = false) {
  const points = Array.from({ length: WAVE_SAMPLES + 1 }, (_, sample) => {
    const x = (sample / WAVE_SAMPLES) * TILE_WIDTH;
    const spacingScale = 0.9 - 0.25 * Math.cos((2 * Math.PI * x) / TILE_WIDTH);
    const phase = (2 * Math.PI * x) / WAVE_PERIOD;
    const baseline = 120 + index * WAVE_SPACING;
    const y = 120 + center * WAVE_SPACING + (baseline - (120 + center * WAVE_SPACING)) * spacingScale + 36 * spacingScale * Math.sin(phase);
    return `${x.toFixed(1)} ${y.toFixed(2)}`;
  });

  return reverse ? points.reverse() : points;
}

function waveContour(index: number, center: number) {
  return `M ${wavePoints(index, center).join(" L ")}`;
}

function waveBand(upper: number, lower: number, center: number) {
  return `M ${wavePoints(upper, center).join(" L ")} L ${wavePoints(lower, center, true).join(" L ")} Z`;
}

const CENTER = (WAVE_COUNT - 1) / 2;
const WAVE_GEOMETRY = {
  bands: Array.from({ length: WAVE_COUNT - 1 }, (_, index) =>
    waveBand(index, index + 1, CENTER)),
  lines: Array.from({ length: WAVE_COUNT }, (_, index) =>
    waveContour(index, CENTER)),
};

const AtmosphereArtwork = memo(function AtmosphereArtwork({ tileId }: { tileId: string }) {
  return (
    <svg viewBox="0 0 3200 1100" preserveAspectRatio="xMidYMin slice">
      <defs>
        <g id={tileId}>
          {WAVE_GEOMETRY.bands.map((path, index) => (
            <path key={`band-${index}`} className="atmosphere-band" d={path} fill="currentColor" fillOpacity=".28" />
          ))}
          {WAVE_GEOMETRY.lines.map((path, index) => (
            <path key={`line-${index}`} d={path} fill="none" stroke="currentColor" strokeWidth="1.5" />
          ))}
        </g>
      </defs>
      <g className="atmosphere-track">
        <g className="atmosphere-breath">
          {[-1600, 0, 1600, 3200].map((offset) => (
            <use key={offset} href={`#${tileId}`} transform={`translate(${offset} 0)`} />
          ))}
        </g>
      </g>
    </svg>
  );
});

/** Stacked, seamless wave contours for the dashboard background. */
export function Atmosphere() {
  const animationEnabled = useAtmosphereAnimation();
  const tileId = `workspacezero-atmosphere-${useId().replace(/:/g, "")}`;

  return (
    <div className="atmosphere" data-animation={animationEnabled ? "on" : "off"} aria-hidden="true">
      <AtmosphereArtwork tileId={tileId} />
    </div>
  );
}
