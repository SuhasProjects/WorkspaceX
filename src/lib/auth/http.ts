import "server-only";
import { NextResponse } from "next/server";
import type { ApiResponse } from "@/types/contracts";

export class HttpError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) {
    super(message);
    this.name = "HttpError";
  }
}

export function success<T>(data: T, status = 200): NextResponse<ApiResponse<T>> {
  return NextResponse.json({ data }, { status, headers: { "Cache-Control": "no-store" } });
}

export function failure(error: unknown): NextResponse {
  if (error instanceof HttpError) return NextResponse.json(
    { error: { code: error.code, message: error.message } },
    { status: error.status, headers: { "Cache-Control": "no-store" } },
  );
  // Database/provider errors can be logged server-side later, but never sent to browsers.
  return NextResponse.json(
    { error: { code: "INTERNAL_ERROR", message: "The request could not be completed." } },
    { status: 500, headers: { "Cache-Control": "no-store" } },
  );
}

export function checkOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  const protocol = request.headers.get("x-forwarded-proto") ?? new URL(request.url).protocol.slice(0, -1);
  const fetchSite = request.headers.get("sec-fetch-site");
  let fromSameOrigin = false;
  try {
    const parsed = new URL(origin ?? "");
    fromSameOrigin = parsed.host === host && parsed.protocol === `${protocol}:` &&
      !parsed.username && !parsed.password && parsed.pathname === "/" && !parsed.search && !parsed.hash;
  } catch { /* Missing or malformed Origin. */ }
  if (!fromSameOrigin || (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none")) {
    throw new HttpError(403, "FORBIDDEN", "Request origin is not allowed.");
  }
}

export async function readJsonObject(request: Request, maxBytes = 16 * 1024): Promise<Record<string, unknown>> {
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    throw new HttpError(415, "UNSUPPORTED_MEDIA_TYPE", "Use application/json.");
  }
  const length = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(length) && length > maxBytes) {
    throw new HttpError(413, "PAYLOAD_TOO_LARGE", "Request body is too large.");
  }
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, "INVALID_INPUT", "A JSON body is required.");
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new HttpError(413, "PAYLOAD_TOO_LARGE", "Request body is too large.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const body = Buffer.concat(chunks).toString("utf8");
  let parsed: unknown;
  try { parsed = JSON.parse(body); }
  catch { throw new HttpError(400, "INVALID_INPUT", "Malformed JSON body."); }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new HttpError(400, "INVALID_INPUT", "A JSON object is required.");
  }
  return parsed as Record<string, unknown>;
}

export function onlyFields(input: Record<string, unknown>, allowed: readonly string[]): void {
  if (Object.keys(input).some((key) => !allowed.includes(key))) {
    throw new HttpError(400, "INVALID_INPUT", "Unknown request field.");
  }
}