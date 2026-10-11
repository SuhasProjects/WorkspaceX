const WAVE_COUNT = 17;
const WAVE_SPACING = 24;

function waveContour(baseline: number, amplitude: number) {
  return `M 0 ${baseline} C 100 ${baseline + amplitude}, 300 ${baseline + amplitude}, 400 ${baseline} C 500 ${baseline - amplitude}, 700 ${baseline - amplitude}, 800 ${baseline} C 900 ${baseline + amplitude}, 1100 ${baseline + amplitude}, 1200 ${baseline} C 1300 ${baseline - amplitude}, 1500 ${baseline - amplitude}, 1600 ${baseline}`;
}

function waveBand(upper: number, upperAmplitude: number, lower: number, lowerAmplitude: number) {
  return `${waveContour(upper, upperAmplitude)} L 1600 ${lower} C 1500 ${lower - lowerAmplitude}, 1300 ${lower - lowerAmplitude}, 1200 ${lower} C 1100 ${lower + lowerAmplitude}, 900 ${lower + lowerAmplitude}, 800 ${lower} C 700 ${lower - lowerAmplitude}, 500 ${lower - lowerAmplitude}, 400 ${lower} C 300 ${lower + lowerAmplitude}, 100 ${lower + lowerAmplitude}, 0 ${lower} Z`;
}

/** Stacked, seamless wave contours for the dashboard background. */
export function Atmosphere() {
  const waves = Array.from({ length: WAVE_COUNT }, (_, index) => ({
    baseline: 120 + index * WAVE_SPACING,
    amplitude: 36,
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
                    d={waveBand(wave.baseline, wave.amplitude, waves[index + 1].baseline, waves[index + 1].amplitude)}
                    fill="currentColor"
                    fillOpacity=".28"
                  />
                ))}
                {waves.map((wave, index) => (
                  <path
                    key={`line-${index}`}
                    d={waveContour(wave.baseline, wave.amplitude)}
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
