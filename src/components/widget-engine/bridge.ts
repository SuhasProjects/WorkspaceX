import {
  LIMITS,
  WIDGET_CHANNEL,
  parseChildMessage,
  type JsonValue,
  type ParentMessage,
  type WidgetProtocolError,
  type WidgetRequestMessage,
  type WidgetTheme,
} from "../../lib/widget-protocol/protocol";
import {
  StorageError,
  createMemoryStorage,
  getSharedAdapter,
  personalLocalStorage,
  type StorageAdapter,
} from "./storage-adapters";

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
        void handleRequest(source, registration, message);
        break;
    }
  } catch {
    // A failing host callback must never break the bridge.
  }
}

function withTimeout<T>(promise: Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new StorageError("TIMEOUT", "Storage request timed out.")),
      LIMITS.requestTimeoutMs,
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

async function handleRequest(
  source: Window,
  registration: WidgetRegistration,
  request: WidgetRequestMessage,
) {
  const state = stateFor(registration);
  if (state.inFlight >= LIMITS.maxInFlightPerWidget) {
    respondError(source, request.requestId, {
      code: "RATE_LIMITED",
      message: "Too many storage requests at once.",
    });
    return;
  }

  // Scope comes from the registration (trusted React props), never from the message.
  const scope = { workspaceId: registration.workspaceId, widgetId: registration.widgetId };
  const isShared = request.action === "getShared" || request.action === "setShared";
  const adapter = registration.preview
    ? isShared
      ? state.previewShared
      : state.previewPersonal
    : isShared
      ? getSharedAdapter()
      : personalLocalStorage;

  state.inFlight++;
  let response: ParentMessage;
  try {
    let value: JsonValue = null;
    if (request.action === "getShared" || request.action === "getPersonal") {
      value = await withTimeout(adapter.get(scope, request.key));
    } else {
      await withTimeout(adapter.set(scope, request.key, request.value ?? null));
    }
    response = { channel: WIDGET_CHANNEL, kind: "response", requestId: request.requestId, ok: true, value };
  } catch (err) {
    const error =
      err instanceof StorageError
        ? { code: err.code, message: err.message }
        : { code: "INTERNAL_ERROR" as const, message: "Storage request failed." };
    response = { channel: WIDGET_CHANNEL, kind: "response", requestId: request.requestId, ok: false, error };
  } finally {
    state.inFlight--;
  }

  // The widget may have been unmounted or replaced while we waited.
  if (registry.get(source) === registration) send(source, response);
}

interface RegistrationState {
  inFlight: number;
  previewShared: StorageAdapter;
  previewPersonal: StorageAdapter;
}
const states = new WeakMap<WidgetRegistration, RegistrationState>();

function stateFor(registration: WidgetRegistration): RegistrationState {
  let state = states.get(registration);
  if (!state) {
    state = { inFlight: 0, previewShared: createMemoryStorage(), previewPersonal: createMemoryStorage() };
    states.set(registration, state);
  }
  return state;
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

export function sendThemeToWidget(frame: Window, theme: WidgetTheme, tokens?: Record<string, string>) {
  if (!registry.has(frame)) return;
  send(frame, { channel: WIDGET_CHANNEL, kind: "theme", theme, tokens });
}
