"use client";

import { useCallback, useEffect, useRef } from "react";
import type { CSSProperties } from "react";

export type WorkspaceRevealSound = {
  play: () => void;
  cancel: () => void;
};

const silentSound: WorkspaceRevealSound = { play() {}, cancel() {} };

/** Prepare audio during the sign-in gesture so browsers allow it after authentication. */
export function prepareWorkspaceRevealSound(): WorkspaceRevealSound {
  try {
    if (!window.AudioContext) return silentSound;
    const context = new window.AudioContext();
    void context.resume().catch(() => undefined);
    let played = false;
    const cancel = () => {
      if (context.state !== "closed") void context.close().catch(() => undefined);
    };

    return {
      play() {
        if (played) return;
        played = true;
        void context.resume().then(() => {
          if (context.state === "closed") return;
          const now = context.currentTime;
          const warmth = context.createBiquadFilter();
          warmth.type = "lowpass";
          warmth.frequency.setValueAtTime(2200, now);
          warmth.frequency.exponentialRampToValueAtTime(3600, now + 0.85);
          warmth.frequency.setValueAtTime(3600, now + 1.05);
          const master = context.createGain();
          master.gain.setValueAtTime(0.0001, now);
          master.gain.exponentialRampToValueAtTime(0.3, now + 0.5);
          master.gain.setValueAtTime(0.3, now + 0.95);
          master.gain.exponentialRampToValueAtTime(0.0001, now + 1.65);
          master.connect(context.destination);
          warmth.connect(master);

          [
            { start: 0, from: 293.66, to: 329.63, level: 0.075, detune: -4 },
            { start: 0.025, from: 293.66, to: 329.63, level: 0.075, detune: 4 },
            { start: 0.04, from: 369.99, to: 415.3, level: 0.055, detune: -3 },
            { start: 0.065, from: 369.99, to: 415.3, level: 0.055, detune: 3 },
            { start: 0.08, from: 440, to: 493.88, level: 0.035, detune: -2 },
            { start: 0.105, from: 440, to: 493.88, level: 0.035, detune: 2 },
            { start: 0.13, from: 587.33, to: 659.25, level: 0.018, detune: -1.5 },
            { start: 0.155, from: 587.33, to: 659.25, level: 0.018, detune: 1.5 },
          ].forEach(({ start, from, to, level, detune }) => {
            const oscillator = context.createOscillator();
            const envelope = context.createGain();
            const beginning = now + start;
            oscillator.type = "sine";
            oscillator.detune.setValueAtTime(detune, beginning);
            oscillator.frequency.setValueAtTime(from, beginning);
            oscillator.frequency.exponentialRampToValueAtTime(to, beginning + 0.9);
            envelope.gain.setValueAtTime(0.0001, beginning);
            envelope.gain.exponentialRampToValueAtTime(level, beginning + 0.42);
            envelope.gain.setValueAtTime(level, now + 1.05);
            envelope.gain.exponentialRampToValueAtTime(0.0001, now + 1.6);
            oscillator.connect(envelope);
            envelope.connect(warmth);
            oscillator.start(beginning);
            oscillator.stop(now + 1.65);
          });

          window.setTimeout(cancel, 1900);
        }).catch(() => undefined);
      },
      cancel,
    };
  } catch {
    return silentSound;
  }
}

export function WorkspaceReveal({ sound, onComplete }: {
  sound: WorkspaceRevealSound | null;
  onComplete: () => void;
}) {
  const soundRef = useRef(sound);
  const playedRef = useRef(false);

  const playSound = useCallback(() => {
    if (playedRef.current) return;
    playedRef.current = true;
    soundRef.current?.play();
  }, []);

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) playSound();
    const timer = window.setTimeout(onComplete, reducedMotion ? 1100 : 3300);
    return () => window.clearTimeout(timer);
  }, [onComplete, playSound]);

  return (
    <div className="workspace-reveal" aria-label="WorkspaceZero" role="status">
      <div className="workspace-reveal-squares" aria-hidden="true">
        {Array.from({ length: 9 }, (_, index) => (
          <span key={index} className="workspace-reveal-square" style={{
            "--square-size": `${22 + index * 9}vmin`,
            "--square-duration": `${1.65 - index * 0.12}s`,
            "--square-delay": `${index * 0.075}s`,
          } as CSSProperties} />
        ))}
      </div>
      <p className="workspace-reveal-wordmark" onAnimationStart={playSound}>
        <span>Workspace</span><span className="workspace-reveal-zero">Zero</span>
      </p>
    </div>
  );
}
