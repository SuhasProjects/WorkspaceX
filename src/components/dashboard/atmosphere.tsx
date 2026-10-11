/** Lightweight decorative vector contours; no image requests. */
export function Atmosphere() {
  return <div className="atmosphere" aria-hidden="true"><svg viewBox="0 0 1600 1100" preserveAspectRatio="xMidYMin slice"><defs><linearGradient id="wave-surface" x1="0" y1="0" x2="0.8" y2="1"><stop stopColor="#363940" /><stop offset=".45" stopColor="#14161b" /><stop offset="1" stopColor="#090b0f" /></linearGradient></defs>
    {Array.from({ length: 17 }, (_, index) => <path key={index} d={`M -200 ${70 + index * 24} C 200 ${-220 + index * 26}, 370 ${520 + index * 12}, 810 ${200 + index * 24} S 1370 ${40 + index * 31}, 1850 ${400 + index * 30} L 1850 1200 L -200 1200 Z`} fill="url(#wave-surface)" stroke="currentColor" strokeWidth="1" />)}
  </svg></div>;
}
