import "server-only";
import { getDatabase } from "./client";
import { getWidget } from "./repository";
import { HttpError } from "@/lib/auth/http";
import { LIMITS, isJsonValue, isValidStorageKey, jsonByteSize } from "@/lib/widget-protocol/protocol";
import type { JsonValue, StorageResult } from "@/types/contracts";

function validWidgetId(widgetId: unknown): widgetId is string {
  return typeof widgetId === "string" && /^[0-9a-f-]{36}$/.test(widgetId);
}
async function registeredWidget(workspaceId: string, widgetId: unknown, key: unknown): Promise<string> {
  if (!validWidgetId(widgetId) || !isValidStorageKey(key)) {
    throw new HttpError(400, "INVALID_INPUT", "Invalid widget ID or storage key.");
  }
  if (!(await getWidget(workspaceId, widgetId))) {
    throw new HttpError(404, "NOT_FOUND", "Widget not found.");
  }
  return widgetId;
}

export async function readShared(workspaceId: string, widgetId: unknown, key: unknown): Promise<StorageResult> {
  const id = await registeredWidget(workspaceId, widgetId, key);
  const db = await getDatabase();
  const record = await db.collection("widgetData").findOne(
    { workspaceId, widgetId: id, key }, { projection: { value: 1 } },
  );
  if (!record) return { value: null, exists: false };
  return { value: record.value as JsonValue, exists: true };
}

export async function writeShared(workspaceId: string, widgetId: unknown, key: unknown, value: unknown): Promise<void> {
  const id = await registeredWidget(workspaceId, widgetId, key);
  if (!isJsonValue(value)) throw new HttpError(400, "INVALID_INPUT", "Storage value must be JSON-compatible.");
  if (jsonByteSize(value) > LIMITS.maxValueBytes) {
    throw new HttpError(413, "PAYLOAD_TOO_LARGE", "Storage value exceeds 64 KiB.");
  }
  const db = await getDatabase();
  await db.collection("widgetData").updateOne(
    { workspaceId, widgetId: id, key },
    { $set: { value, updatedAt: new Date() } },
    { upsert: true },
  );
}