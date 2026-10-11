import {
  WIDGET_CHANNEL,
  parseChildMessage,
  type ParentMessage,
  type WidgetProtocolError,
  type WidgetTheme,
} from "../../lib/widget-protocol/protocol";

export interface WidgetRegistration {
  widgetId: string;
  workspaceId: string;
  preview: boolean;
  onReady: () => void;
  onRuntimeError: (message: string) => void;
}

/**
 * Widgets are identified only by the iframe window that sent the message.
 * Nothing the widget says about itself (ids, origin) is trusted.
 */
const registry = new Map<Window, WidgetRegistration>();
let listening = false;

function send(target: Window, message: ParentMessage) {
  // Sandboxed frames have an opaque origin, so "*" is the only usable target.
  // Safe because nothing secret is ever sent to a widget.
  try {
    target.postMessage(message, "*");
  } catch {
    // Frame already gone.
  }
}

function respondError(target: Window, requestId: string, error: WidgetProtocolError) {
  send(target, { channel: WIDGET_CHANNEL, kind: "response", requestId, ok: false, error });
}

function handleMessage(event: MessageEvent) {
  const source = event.source as Window | null;
  if (!source) return;
  const registration = registry.get(source);
  if (!registration) return;

  const parsed = parseChildMessage(event.data);
  if (!parsed) return;
  if (!parsed.ok) {
    if (parsed.requestId) respondError(source, parsed.requestId, parsed.error);
    return;
  }

  const message = parsed.message;
  try {
    switch (message.kind) {
      case "ready":
        registration.onReady();
        break;
      case "error":
        registration.onRuntimeError(message.message);
        break;
      case "request":
        // Storage routing arrives in Milestone 2.
        respondError(source, message.requestId, {
          code: "STORAGE_UNAVAILABLE",
          message: "Widget storage is not enabled yet.",
        });
        break;
    }
  } catch {
    // A failing host callback must never break the bridge.
  }
}

export function registerWidgetFrame(frame: Window, registration: WidgetRegistration): () => void {
  if (typeof window !== "undefined" && !listening) {
    window.addEventListener("message", handleMessage);
    listening = true;
  }
  registry.set(frame, registration);
  return () => {
    if (registry.get(frame) === registration) registry.delete(frame);
  };
}

export function sendThemeToWidget(frame: Window, theme: WidgetTheme) {
  if (!registry.has(frame)) return;
  send(frame, { channel: WIDGET_CHANNEL, kind: "theme", theme });
}
