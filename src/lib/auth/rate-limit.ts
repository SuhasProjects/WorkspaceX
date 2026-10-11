import "server-only";
import { HttpError } from "./http";

/**
 * In-memory sliding window, per serverless instance. Enough to blunt
 * credential stuffing on a single instance; a shared store can replace the
 * map later without changing callers.
 */
const windows = new Map<string, number[]>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;

export function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return (forwarded?.split(",")[0].trim() || request.headers.get("x-real-ip") || "unknown").slice(0, 100);
}

export function enforceRateLimit(bucket: string): void {
  const now = Date.now();
  const recent = (windows.get(bucket) ?? []).filter((at) => now - at < WINDOW_MS);
  if (recent.length >= MAX_ATTEMPTS) throw new HttpError(429, "RATE_LIMITED", "Too many attempts. Try again in a few minutes.");
  recent.push(now);
  windows.set(bucket, recent);
  if (windows.size > 10_000) windows.clear();
}

export function clearRateLimit(bucket: string): void {
  windows.delete(bucket);
}
