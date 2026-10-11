import type { ApiResponse, StorageResult } from "@/types/contracts";
import { LIMITS, type JsonValue, type WidgetErrorCode } from "../../lib/widget-protocol/protocol";

/** Who is asking. Always filled in by the parent from trusted state, never by the widget. */
export interface StorageScope {
  workspaceId: string;
  widgetId: string;
}

export interface StorageAdapter {
  /** Resolves to null when the key has never been written. */
  get(scope: StorageScope, key: string): Promise<JsonValue>;
  set(scope: StorageScope, key: string, value: JsonValue): Promise<void>;
}

export class StorageError extends Error {
  constructor(
    public code: WidgetErrorCode,
    message: string,
  ) {
    super(message);
  }
}

const KNOWN_CODES = new Set<WidgetErrorCode>([
  "INVALID_INPUT",
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "NOT_FOUND",
  "PAYLOAD_TOO_LARGE",
  "RATE_LIMITED",
  "SERVICE_UNAVAILABLE",
  "INTERNAL_ERROR",
]);

// ---------------------------------------------------------------------------
// Shared: Backend's /api/storage. The session cookie identifies the workspace.
// ---------------------------------------------------------------------------

async function callStorageApi<T>(input: string, init: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(input, {
      ...init,
      credentials: "same-origin",
      cache: "no-store",
      signal: AbortSignal.timeout(LIMITS.requestTimeoutMs),
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "TimeoutError") {
      throw new StorageError("TIMEOUT", "Shared storage took too long to respond.");
    }
    throw new StorageError("SERVICE_UNAVAILABLE", "Could not reach shared storage.");
  }

  let body: ApiResponse<T> | null = null;
  try {
    body = (await response.json()) as ApiResponse<T>;
  } catch {
    // Non-JSON body; handled below.
  }
  if (response.ok && body && "data" in body && body.data !== undefined) return body.data;

  const apiError = body && "error" in body ? body.error : undefined;
  const code = apiError && KNOWN_CODES.has(apiError.code as WidgetErrorCode)
    ? (apiError.code as WidgetErrorCode)
    : "INTERNAL_ERROR";
  throw new StorageError(code, apiError?.message ?? `Shared storage failed (${response.status}).`);
}

export const apiSharedStorage: StorageAdapter = {
  async get({ widgetId }, key) {
    const params = new URLSearchParams({ widgetId, key });
    const result = await callStorageApi<StorageResult>(`/api/storage?${params}`, { method: "GET" });
    return result.exists ? result.value : null;
  },
  async set({ widgetId }, key, value) {
    await callStorageApi<unknown>("/api/storage", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ widgetId, key, value }),
    });
  },
};

// ---------------------------------------------------------------------------
// Browser localStorage, namespaced by workspace + widget + key.
// ---------------------------------------------------------------------------

function localStorageAdapter(prefix: string): StorageAdapter {
  const fullKey = ({ workspaceId, widgetId }: StorageScope, key: string) =>
    `${prefix}:${encodeURIComponent(workspaceId)}:${encodeURIComponent(widgetId)}:${key}`;

  return {
    async get(scope, key) {
      let raw: string | null;
      try {
        raw = window.localStorage.getItem(fullKey(scope, key));
      } catch {
        throw new StorageError("SERVICE_UNAVAILABLE", "Browser storage is unavailable.");
      }
      if (raw === null) return null;
      try {
        return JSON.parse(raw) as JsonValue;
      } catch {
        return null;
      }
    },
    async set(scope, key, value) {
      try {
        window.localStorage.setItem(fullKey(scope, key), JSON.stringify(value));
      } catch {
        throw new StorageError("SERVICE_UNAVAILABLE", "Browser storage is full or unavailable.");
      }
    },
  };
}

/** Personal data: stays in this browser only. */
export const personalLocalStorage = localStorageAdapter("wz:personal:v1");

/**
 * Stand-in for /api/storage while the backend endpoint is unfinished. Persists
 * in this browser only, so it cannot demonstrate cross-browser sharing.
 */
export const mockSharedStorage = localStorageAdapter("wz:mock-shared:v1");

/** Previews (unsaved widgets): throwaway memory, cleared on reload. */
export function createMemoryStorage(): StorageAdapter {
  const data = new Map<string, string>();
  return {
    async get(_scope, key) {
      const raw = data.get(key);
      return raw === undefined ? null : (JSON.parse(raw) as JsonValue);
    },
    async set(_scope, key, value) {
      data.set(key, JSON.stringify(value));
    },
  };
}

// ---------------------------------------------------------------------------
// Engine configuration
// ---------------------------------------------------------------------------

let sharedAdapter: StorageAdapter = apiSharedStorage;

/** Call once at startup with "mock" to develop without the backend. Default is "api". */
export function configureWidgetEngine(options: { sharedStorage: "api" | "mock" }) {
  sharedAdapter = options.sharedStorage === "mock" ? mockSharedStorage : apiSharedStorage;
}

export function getSharedAdapter(): StorageAdapter {
  return sharedAdapter;
}
