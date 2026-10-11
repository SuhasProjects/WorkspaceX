'use client';

import { useEffect, useRef } from 'react';

/** Animation tuning constants */
const ANIMATION_DURATION_MS = 30000; // 30 seconds for a full cycle (calm, barely noticeable)
const DISPLACEMENT_AMPLITUDE = 12; // Maximum vertical displacement in pixels per line
const TARGET_FPS = 30; // Cap to 30fps for performance (can increase if needed)

/**
 * Animated atmospheric background with fluid, water-like contour lines.
 * Uses canvas 2D for performance; pseudo-element ::after provides the dark arc.
 * Respects prefers-reduced-motion and theme switching.
 */
export function Atmosphere() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationIdRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number>(0);
  const startTimeRef = useRef<number>(Date.now());
  const isReducedMotionRef = useRef<boolean>(false);
  const isHiddenRef = useRef<boolean>(false);

  useEffect(() => {
    // Check for prefers-reduced-motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    isReducedMotionRef.current = prefersReducedMotion;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    // Set up canvas dimensions with device pixel ratio capped at 2
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = 1400;
    const height = 1100;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    // Get theme from parent dashboard-shell
    const getTheme = (): 'dark' | 'light' => {
      const parent = canvas.closest('[data-theme]');
      const theme = parent?.getAttribute('data-theme');
      return theme === 'light' ? 'light' : 'dark';
    };

    // Get opacity based on theme
    const getOpacity = (): number => {
      const theme = getTheme();
      return theme === 'light' ? 0.045 : 0.68;
    };

    // Gradient colors (matching CSS linearGradient)
    const gradientStops = [
      { offset: 0, color: '#363940' },
      { offset: 0.45, color: '#14161b' },
      { offset: 1, color: '#090b0f' }
    ];

    // Draw a single line at the given base y, with wave displacement
    const drawLine = (
      index: number,
      time: number,
      yOffset: number
    ) => {
      // Calculate vertical displacement using layered sine waves
      // Primary wave: slow (~30s), secondary wave: faster (~60s), phase-staggered per line
      const primaryWave = Math.sin((time * 0.001) + (index * 0.2)) * DISPLACEMENT_AMPLITUDE;
      const secondaryWave = Math.sin((time * 0.0005) + (index * 0.5)) * (DISPLACEMENT_AMPLITUDE * 0.6);
      const totalDisplacement = primaryWave + secondaryWave;

      // Base y position for this line
      const baseY = 70 + index * 24 + totalDisplacement;

      // Create gradient for this stroke
      const gradient = ctx.createLinearGradient(0, baseY - 50, 0.8 * width, baseY + 50);
      gradientStops.forEach((stop) => {
        gradient.addColorStop(stop.offset, stop.color);
      });

      ctx.strokeStyle = gradient;
      ctx.lineWidth = 1;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // Draw the curved path using quadratic Bezier curves
      // Matches the original SVG path structure
      const y1 = baseY;
      const y2 = -220 + index * 26 + totalDisplacement * 0.8;
      const y3 = 520 + index * 12 + totalDisplacement * 0.5;
      const y4 = 200 + index * 24 + totalDisplacement;
      const y5 = 40 + index * 31 + totalDisplacement * 0.9;
      const y6 = 400 + index * 30 + totalDisplacement;

      ctx.beginPath();
      ctx.moveTo(-200, y1);
      ctx.bezierCurveTo(200, y2, 370, y3, 810, y4);
      ctx.bezierCurveTo(1370, y5, 1370, y5, 1850, y6);
      ctx.stroke();
    };

    // Animation loop using requestAnimationFrame
    const animate = (currentTime: number) => {
      // FPS throttling
      const deltaTime = currentTime - lastFrameTimeRef.current;
      const frameInterval = TARGET_FPS ? 1000 / TARGET_FPS : 0;

      if (deltaTime < frameInterval) {
        animationIdRef.current = requestAnimationFrame(animate);
        return;
      }

      lastFrameTimeRef.current = currentTime;

      // Calculate elapsed time from start
      const elapsed = currentTime - startTimeRef.current;
      const time = isReducedMotionRef.current ? 0 : elapsed;

      // Clear canvas
      ctx.clearRect(0, 0, width, height);

      // Get current theme opacity
      const opacity = getOpacity();
      ctx.globalAlpha = opacity;

      // Draw all 17 contour lines
      for (let i = 0; i < 17; i++) {
        drawLine(i, time, 0);
      }

      // Reset global alpha
      ctx.globalAlpha = 1;

      // Continue animation if not paused
      if (!isHiddenRef.current || isReducedMotionRef.current) {
        animationIdRef.current = requestAnimationFrame(animate);
      }
    };

    // Handle visibility change (pause animation when tab is hidden)
    const handleVisibilityChange = () => {
      isHiddenRef.current = document.hidden;
      if (!document.hidden && animationIdRef.current === null) {
        // Resume animation
        animationIdRef.current = requestAnimationFrame(animate);
      }
    };

    // Handle theme changes
    const handleThemeChange = () => {
      // Canvas will re-draw on next frame with new opacity
    };

    // Start animation
    if (!isReducedMotionRef.current) {
      animationIdRef.current = requestAnimationFrame(animate);
    } else {
      // Draw static frame for reduced motion
      animationIdRef.current = requestAnimationFrame(() => {
        ctx.clearRect(0, 0, width, height);
        const opacity = getOpacity();
        ctx.globalAlpha = opacity;
        for (let i = 0; i < 17; i++) {
          drawLine(i, 0, 0);
        }
        ctx.globalAlpha = 1;
      });
    }

    // Listen for visibility change
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('themechange', handleThemeChange);

    // Mutation observer to detect theme changes on parent
    const parent = canvas.closest('[data-theme]');
    const themeObserver = new MutationObserver(() => {
      handleThemeChange();
    });
    if (parent) {
      themeObserver.observe(parent, { attributes: true, attributeFilter: ['data-theme'] });
    }

    // Cleanup
    return () => {
      if (animationIdRef.current !== null) {
        cancelAnimationFrame(animationIdRef.current);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('themechange', handleThemeChange);
      themeObserver.disconnect();
    };
  }, []);

  return (
    <div className="atmosphere" aria-hidden="true">
      <canvas ref={canvasRef} />
    </div>
  );
}
