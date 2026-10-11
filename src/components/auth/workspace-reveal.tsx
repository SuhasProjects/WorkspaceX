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
          const master = context.createGain();
          master.gain.setValueAtTime(0.0001, now);
          master.gain.exponentialRampToValueAtTime(0.2, now + 0.08);
          master.gain.exponentialRampToValueAtTime(0.0001, now + 1.15);
          master.connect(context.destination);

          [
            { start: 0, from: 392, to: 587, level: 0.52 },
            { start: 0.12, from: 587, to: 880, level: 0.36 },
            { start: 0.25, from: 784, to: 1176, level: 0.2 },
          ].forEach(({ start, from, to, level }) => {
            const oscillator = context.createOscillator();
            const envelope = context.createGain();
            const beginning = now + start;
            oscillator.type = "sine";
            oscillator.frequency.setValueAtTime(from, beginning);
            oscillator.frequency.exponentialRampToValueAtTime(to, beginning + 0.52);
            envelope.gain.setValueAtTime(0.0001, beginning);
            envelope.gain.exponentialRampToValueAtTime(level, beginning + 0.07);
            envelope.gain.exponentialRampToValueAtTime(0.0001, beginning + 1.05);
            oscillator.connect(envelope);
            envelope.connect(master);
            oscillator.start(beginning);
            oscillator.stop(beginning + 1.08);
          });

          window.setTimeout(cancel, 1500);
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
