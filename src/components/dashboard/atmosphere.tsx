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

/** Stacked, seamless wave contours for the dashboard background. */
export function Atmosphere() {
  const center = (WAVE_COUNT - 1) / 2;
  const waves = Array.from({ length: WAVE_COUNT }, (_, index) => ({
    index,
  }));

  return (
    <div className="atmosphere" aria-hidden="true">
      <svg viewBox="0 0 3200 1100" preserveAspectRatio="xMidYMin slice">
        <g className="atmosphere-track">
          <g className="atmosphere-breath">
            {[-1600, 0, 1600, 3200].map((offset) => (
              <g key={offset} transform={`translate(${offset} 0)`}>
                {waves.slice(0, -1).map((wave, index) => (
                  <path
                    key={`band-${index}`}
                    d={waveBand(wave.index, waves[index + 1].index, center)}
                    fill="currentColor"
                    fillOpacity=".28"
                  />
                ))}
                {waves.map((wave, index) => (
                  <path
                    key={`line-${index}`}
                    d={waveContour(wave.index, center)}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  />
                ))}
              </g>
            ))}
          </g>
        </g>
      </svg>
    </div>
  );
}
