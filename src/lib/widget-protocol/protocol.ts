/**
 * WorkspaceZero widget protocol (channel "workspacezero.widget.v1").
 *
 * This file is the single source of truth for every message that crosses the
 * iframe boundary. Both the in-iframe runtime and the parent bridge follow it.
 */

import { WIDGET_CHANNEL, type JsonValue, type Theme, type WidgetAction } from "@/types/contracts";

export { WIDGET_CHANNEL };
export type { JsonValue };
export type WidgetTheme = Theme;
export type StorageAction = WidgetAction;

export const STORAGE_ACTIONS: readonly StorageAction[] = [
  "getShared",
  "setShared",
  "getPersonal",
  "setPersonal",
];

export const LIMITS = {
  maxKeyLength: 128,
  maxValueBytes: 64 * 1024,
  maxRequestIdLength: 64,
  maxErrorMessageLength: 500,
  maxErrorReportsPerDocument: 20,
  maxInFlightPerWidget: 32,
  maxWidgetHtmlBytes: 512 * 1024,
  maxJsonDepth: 32,
  requestTimeoutMs: 10_000,
  readyTimeoutMs: 10_000,
} as const;

export const STORAGE_KEY_PATTERN = /^[A-Za-z0-9_.:-]{1,128}$/;
const REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

// ---------------------------------------------------------------------------
// Child (widget iframe) -> parent
// ---------------------------------------------------------------------------

export interface WidgetRequestMessage {
  channel: typeof WIDGET_CHANNEL;
  kind: "request";
  requestId: string;
  action: StorageAction;
  key: string;
  value?: JsonValue;
}

/** Sent once by the runtime when the widget document has parsed. Engine-internal. */
export interface WidgetReadyMessage {
  channel: typeof WIDGET_CHANNEL;
  kind: "ready";
}

/** Uncaught error or blocked resource inside the widget. Engine-internal. */
export interface WidgetErrorMessage {
  channel: typeof WIDGET_CHANNEL;
  kind: "error";
  message: string;
}

export type ChildMessage = WidgetRequestMessage | WidgetReadyMessage | WidgetErrorMessage;

// ---------------------------------------------------------------------------
// Parent -> child (widget iframe)
// ---------------------------------------------------------------------------

export type WidgetErrorCode =
  | "BAD_REQUEST"
  | "INVALID_KEY"
  | "INVALID_VALUE"
  | "PAYLOAD_TOO_LARGE"
  | "TOO_MANY_REQUESTS"
  | "TIMEOUT"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "STORAGE_UNAVAILABLE"
  | "INTERNAL";

export interface WidgetProtocolError {
  code: WidgetErrorCode;
  message: string;
}

export type WidgetResponseMessage =
  | {
      channel: typeof WIDGET_CHANNEL;
      kind: "response";
      requestId: string;
      ok: true;
      value: JsonValue;
    }
  | {
      channel: typeof WIDGET_CHANNEL;
      kind: "response";
      requestId: string;
      ok: false;
      error: WidgetProtocolError;
    };

export interface WidgetThemeMessage {
  channel: typeof WIDGET_CHANNEL;
  kind: "theme";
  theme: WidgetTheme;
}

export type ParentMessage = WidgetResponseMessage | WidgetThemeMessage;

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export type ParseResult =
  | { ok: true; message: ChildMessage }
  /** On our channel but invalid. `requestId` is set when we can still answer the sender. */
  | { ok: false; requestId?: string; error: WidgetProtocolError };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

export function isJsonValue(value: unknown, depth = 0): value is JsonValue {
  if (depth > LIMITS.maxJsonDepth) return false;
  if (value === null) return true;
  switch (typeof value) {
    case "string":
    case "boolean":
      return true;
    case "number":
      return Number.isFinite(value);
    case "object":
      if (Array.isArray(value)) return value.every((item) => isJsonValue(item, depth + 1));
      if (!isPlainObject(value)) return false;
      return Object.values(value).every((item) => isJsonValue(item, depth + 1));
    default:
      return false;
  }
}

export function jsonByteSize(value: JsonValue): number {
  return new TextEncoder().encode(JSON.stringify(value)).length;
}

export function isValidStorageKey(key: unknown): key is string {
  return typeof key === "string" && STORAGE_KEY_PATTERN.test(key);
}

/**
 * Validates an incoming child message. Returns null for anything not on our
 * channel, so unrelated postMessage traffic is ignored silently.
 */
export function parseChildMessage(data: unknown): ParseResult | null {
  if (!isPlainObject(data) || data.channel !== WIDGET_CHANNEL) return null;

  switch (data.kind) {
    case "ready":
      return { ok: true, message: { channel: WIDGET_CHANNEL, kind: "ready" } };

    case "error": {
      const message =
        typeof data.message === "string" ? data.message : "Unknown widget error";
      return {
        ok: true,
        message: {
          channel: WIDGET_CHANNEL,
          kind: "error",
          message: message.slice(0, LIMITS.maxErrorMessageLength),
        },
      };
    }

    case "request": {
      const { requestId, action, key } = data;
      if (typeof requestId !== "string" || !REQUEST_ID_PATTERN.test(requestId)) {
        return { ok: false, error: { code: "BAD_REQUEST", message: "Invalid requestId" } };
      }
      const fail = (code: WidgetErrorCode, message: string): ParseResult => ({
        ok: false,
        requestId,
        error: { code, message },
      });

      if (typeof action !== "string" || !STORAGE_ACTIONS.includes(action as StorageAction)) {
        return fail("BAD_REQUEST", "Unknown action");
      }
      if (!isValidStorageKey(key)) {
        return fail(
          "INVALID_KEY",
          "Storage keys must be 1-128 characters of letters, digits, _ . : -",
        );
      }

      const isWrite = action === "setShared" || action === "setPersonal";
      if (!isWrite) {
        return {
          ok: true,
          message: {
            channel: WIDGET_CHANNEL,
            kind: "request",
            requestId,
            action: action as StorageAction,
            key,
          },
        };
      }

      if (!("value" in data) || !isJsonValue(data.value)) {
        return fail("INVALID_VALUE", "Value must be JSON-compatible");
      }
      if (jsonByteSize(data.value) > LIMITS.maxValueBytes) {
        return fail("PAYLOAD_TOO_LARGE", `Value exceeds ${LIMITS.maxValueBytes} bytes`);
      }
      return {
        ok: true,
        message: {
          channel: WIDGET_CHANNEL,
          kind: "request",
          requestId,
          action: action as StorageAction,
          key,
          value: data.value,
        },
      };
    }

    default:
      return { ok: false, error: { code: "BAD_REQUEST", message: "Unknown message kind" } };
  }
}
