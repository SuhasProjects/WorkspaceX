/** Lightweight decorative vector contours; no image requests. */
export function Atmosphere() {
  return (
    <div className="atmosphere" aria-hidden="true">
      <svg viewBox="0 0 3200 1100" preserveAspectRatio="xMidYMin slice">
        <defs>
          <linearGradient id="wave-surface" x1="0" y1="0" x2="0.8" y2="1">
            <stop stopColor="#363940" />
            <stop offset=".45" stopColor="#14161b" />
            <stop offset="1" stopColor="#090b0f" />
          </linearGradient>
        </defs>
        <g className="atmosphere-track">
          {[-1600, 0, 1600, 3200].map((offset) => (
            <g key={offset} transform={`translate(${offset} 0)`}>
              {Array.from({ length: 17 }, (_, index) => {
                const baseline = 70 + index * 24;
                const amplitude = 150 + (index % 4) * 18;
                const direction = index % 2 === 0 ? 1 : -1;
                const contour = `M 0 ${baseline} C 100 ${baseline + direction * amplitude}, 300 ${baseline + direction * amplitude}, 400 ${baseline} C 500 ${baseline - direction * amplitude}, 700 ${baseline - direction * amplitude}, 800 ${baseline} C 900 ${baseline + direction * amplitude}, 1100 ${baseline + direction * amplitude}, 1200 ${baseline} C 1300 ${baseline - direction * amplitude}, 1500 ${baseline - direction * amplitude}, 1600 ${baseline}`;

                return (
                  <g key={index}>
                    <path d={`${contour} L 1600 1200 L 0 1200 Z`} fill="url(#wave-surface)" />
                    <path d={contour} fill="none" stroke="currentColor" strokeWidth="1" />
                  </g>
                );
              })}
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}
