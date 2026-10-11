"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { LIMITS, type WidgetTheme } from "../../lib/widget-protocol/protocol";
import { buildWidgetDocument } from "../../lib/widget-protocol/build-document";
import { registerWidgetFrame, sendThemeToWidget } from "./bridge";

export type WidgetStatus = "loading" | "ready" | "failed";

export interface WidgetRendererProps {
  /** Real widget id from the backend. */
  widgetId: string;
  /** Authenticated workspace id from trusted app state (used to namespace personal data). */
  workspaceId: string;
  /** Widget HTML exactly as returned by /api/generate or /api/widgets. */
  html: string;
  theme: WidgetTheme;
  /** Accessible label for the iframe. */
  title?: string;
  /** Unsaved widget being reviewed after generation. */
  preview?: boolean;
  className?: string;
  onStatusChange?: (status: WidgetStatus) => void;
  onRuntimeError?: (message: string) => void;
}

const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

function hashString(value: string): string {
  let hash = 5381;
  for (let i = 0; i < value.length; i++) hash = ((hash << 5) + hash + value.charCodeAt(i)) | 0;
  return (hash >>> 0).toString(36);
}

export function WidgetRenderer({
  widgetId,
  workspaceId,
  html,
  theme,
  title = "Workspace widget",
  preview = false,
  className = "",
  onStatusChange,
  onRuntimeError,
}: WidgetRendererProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const themeRef = useRef(theme);
  const callbacksRef = useRef({ onStatusChange, onRuntimeError });
  const loadCountRef = useRef(0);

  useIsomorphicLayoutEffect(() => {
    themeRef.current = theme;
    callbacksRef.current = { onStatusChange, onRuntimeError };
  });

  // Theme changes are pushed by message instead of rebuilding (and reloading)
  // the widget, so the document is only built with the mount-time theme.
  const [initialTheme] = useState(theme);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<WidgetStatus>("loading");
  const [failure, setFailure] = useState<string | null>(null);
  const [runtimeErrors, setRuntimeErrors] = useState<string[]>([]);

  const built = useMemo(() => buildWidgetDocument(html, initialTheme), [html, initialTheme]);
  const frameKey = `${widgetId}|${workspaceId}|${preview}|${attempt}|${hashString(html)}`;

  useIsomorphicLayoutEffect(() => {
    setRuntimeErrors([]);
    if (!built.ok) {
      setFailure(built.error);
      setStatus("failed");
      return;
    }
    setFailure(null);
    setStatus("loading");
    loadCountRef.current = 0;

    // Registering before the srcdoc's scripts run guarantees no early message is missed.
    const frameWindow = iframeRef.current?.contentWindow;
    if (!frameWindow) return;

    let ready = false;
    const readyTimer = setTimeout(() => {
      if (!ready) {
        setFailure("This widget didn't finish loading. It may contain a bug or be stuck.");
        setStatus("failed");
      }
    }, LIMITS.readyTimeoutMs);

    const unregister = registerWidgetFrame(frameWindow, {
      widgetId,
      workspaceId,
      preview,
      onReady: () => {
        if (ready) return;
        ready = true;
        clearTimeout(readyTimer);
        sendThemeToWidget(frameWindow, themeRef.current);
        setStatus("ready");
      },
      onRuntimeError: (message) => {
        setRuntimeErrors((prev) => [...prev.slice(-4), message]);
        callbacksRef.current.onRuntimeError?.(message);
      },
    });

    return () => {
      clearTimeout(readyTimer);
      unregister();
    };
  }, [frameKey, built]);

  useEffect(() => {
    const frameWindow = iframeRef.current?.contentWindow;
    if (frameWindow && status === "ready") sendThemeToWidget(frameWindow, theme);
  }, [theme, status]);

  useEffect(() => {
    callbacksRef.current.onStatusChange?.(status);
  }, [status]);

  const handleLoad = () => {
    loadCountRef.current += 1;
    // The srcdoc loads exactly once. A second load means the widget navigated
    // its frame somewhere else, which would escape our sandbox policy.
    if (loadCountRef.current > 1) {
      setFailure("This widget tried to navigate away from WorkspaceZero and was stopped.");
      setStatus("failed");
    }
  };

  const dark = theme === "dark";
  const overlay = dark ? "bg-neutral-950/80 text-neutral-300" : "bg-white/80 text-neutral-600";

  return (
    // When the caller passes className it owns the sizing; otherwise fill the parent.
    <div className={`relative w-full overflow-hidden ${className || "h-full min-h-[240px]"}`}>
      {status === "failed" ? (
        <div
          role="alert"
          className={`flex h-full min-h-[240px] flex-col items-center justify-center gap-3 p-6 text-center text-sm ${
            dark ? "bg-neutral-950 text-neutral-300" : "bg-neutral-50 text-neutral-700"
          }`}
        >
          <p className="font-medium">Widget unavailable</p>
          <p className="max-w-sm opacity-80">{failure}</p>
          {built.ok && (
            <button
              type="button"
              onClick={() => setAttempt((n) => n + 1)}
              className="rounded-md border border-current px-3 py-1 text-xs opacity-80 hover:opacity-100"
            >
              Reload widget
            </button>
          )}
        </div>
      ) : (
        <>
          <iframe
            key={frameKey}
            ref={iframeRef}
            title={title}
            sandbox="allow-scripts"
            srcDoc={built.ok ? built.document : undefined}
            referrerPolicy="no-referrer"
            onLoad={handleLoad}
            className="absolute inset-0 h-full w-full border-0"
            style={{ colorScheme: theme }}
          />
          {status === "loading" && (
            <div
              aria-live="polite"
              className={`pointer-events-none absolute inset-0 flex items-center justify-center text-sm ${overlay}`}
            >
              Loading widget…
            </div>
          )}
        </>
      )}
      {runtimeErrors.length > 0 && status !== "failed" && (
        <div
          role="status"
          title={runtimeErrors.join("\n")}
          className="absolute inset-x-0 bottom-0 truncate bg-amber-500/90 px-3 py-1 text-xs text-black"
        >
          Widget error: {runtimeErrors[runtimeErrors.length - 1]}
        </div>
      )}
    </div>
  );
}
