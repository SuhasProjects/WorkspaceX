import "server-only";
import { randomUUID } from "node:crypto";
import type { UpdateFilter } from "mongodb";
import type { GeneratedWidget, JsonValue, Task, TaskStatus, UpdateTaskRequest, Widget, WidgetSize, WidgetSpan } from "@/types/contracts";
import { widgetLimitFor } from "@/lib/billing/plans";
import { checkWorkspaceId, checkedTitle, getWorkspacePlan, type WorkspaceRecord } from "./accounts";
import { DatabaseError, getDatabase } from "./client";

interface WidgetRecord {
  _id: string;
  workspaceId: string;
  title: string;
  html: string;
  size?: WidgetSize;
  span?: WidgetSpan;
  createdAt: Date;
}
interface WidgetDataRecord {
  workspaceId: string;
  widgetId: string;
  key: string;
  value: JsonValue;
  updatedAt: Date;
}
interface TaskRecord {
  _id: string;
  workspaceId: string;
  title: string;
  description?: string;
  dueDate?: string;
  dueTime?: string;
  status: TaskStatus;
  createdAt: Date;
  updatedAt: Date;
}

function publicWidget(record: WidgetRecord): Widget {
  return { id: record._id, title: record.title, html: record.html, size: record.size ?? "large", ...(record.span ? { span: record.span } : {}), createdAt: record.createdAt.toISOString() };
}
function checkedWidgetSize(size: unknown, fallback: WidgetSize): WidgetSize {
  if (size === undefined) return fallback;
  if (size !== "small" && size !== "medium" && size !== "large") {
    throw new DatabaseError("INVALID_INPUT", "Widget size must be small, medium, or large.");
  }
  return size;
}
function checkedDescription(description: string | undefined): string | undefined {
  if (description === undefined) return undefined;
  if (description.length > 2000) throw new DatabaseError("INVALID_INPUT", "Description must be at most 2,000 characters.");
  return description;
}
function checkedStatus(status: string | undefined): TaskStatus {
  if (status === undefined) return "todo";
  if (status !== "todo" && status !== "in_progress" && status !== "done") {
    throw new DatabaseError("INVALID_INPUT", "Invalid task status.");
  }
  return status;
}
function checkedDueDate(dueDate: string | undefined): string | undefined {
  if (dueDate === undefined || dueDate === "") return undefined;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dueDate);
  if (!match) throw new DatabaseError("INVALID_INPUT", "Due date must use YYYY-MM-DD format.");
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) {
    throw new DatabaseError("INVALID_INPUT", "Due date must be a valid calendar date.");
  }
  return dueDate;
}
function checkedDueTime(dueTime: string | undefined): string | undefined {
  if (dueTime === undefined || dueTime === "") return undefined;
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(dueTime)) {
    throw new DatabaseError("INVALID_INPUT", "Due time must use 24-hour HH:mm format.");
  }
  return dueTime;
}
function checkTaskId(id: string): void {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new DatabaseError("INVALID_INPUT", "Invalid task ID.");
  }
}
function publicTask(record: TaskRecord): Task {
  return {
    id: record._id,
    title: record.title,
    ...(record.description === undefined ? {} : { description: record.description }),
    ...(record.dueDate === undefined ? {} : { dueDate: record.dueDate }),
    ...(record.dueTime === undefined ? {} : { dueTime: record.dueTime }),
    status: record.status,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}





export async function countWidgets(workspaceId: string): Promise<number> {
  checkWorkspaceId(workspaceId);
  const db = await getDatabase();
  return db.collection<WidgetRecord>("widgets").countDocuments({ workspaceId });
}

/**
 * Records a subscription change. Callers must only pass states confirmed by
 * the billing provider (verified webhook) or a pending state from checkout.
 */


/** HTTP callers must pass workspace identity from a verified admin session. */
function checkedHtml(html: string): string {
  if (Buffer.byteLength(html, "utf8") > 200 * 1024 ||
      !/<!doctype\s+html\s*>/i.test(html) || !/<html[\s>]/i.test(html) ||
      !/<body[\s>]/i.test(html) || !/<\/html\s*>/i.test(html)) {
    throw new DatabaseError("INVALID_INPUT", "A complete HTML document of at most 200 KiB is required.");
  }
  return html;
}

export async function createWidget(workspaceId: string, input: GeneratedWidget): Promise<Widget> {
  checkWorkspaceId(workspaceId);
  const title = checkedTitle(input.title);
  checkedHtml(input.html);
  // Plan limits come from the workspace owner's account and are enforced here, server-side.
  const { plan } = await getWorkspacePlan(workspaceId);
  const limit = widgetLimitFor(plan);
  if (limit !== null && (await countWidgets(workspaceId)) >= limit) {
    throw new DatabaseError("PLAN_LIMIT_REACHED", `The ${plan} plan allows ${limit} tools. Upgrade to add more.`);
  }
  const db = await getDatabase();
  const record: WidgetRecord = { _id: randomUUID(), workspaceId, title, html: input.html, size: checkedWidgetSize(input.size, "medium"), createdAt: new Date() };
  await db.collection<WidgetRecord>("widgets").insertOne(record);
  return publicWidget(record);
}

export async function listWidgets(workspaceId: string): Promise<Widget[]> {
  checkWorkspaceId(workspaceId);
  const db = await getDatabase();
  const [records, workspace] = await Promise.all([
    db.collection<WidgetRecord>("widgets").find({ workspaceId }).sort({ createdAt: 1, _id: 1 }).toArray(),
    db.collection<WorkspaceRecord>("workspaces").findOne({ _id: workspaceId }, { projection: { widgetOrder: 1 } }),
  ]);
  const rank = new Map((workspace?.widgetOrder ?? []).map((id, index) => [id, index]));
  const last = Number.MAX_SAFE_INTEGER;
  return records
    .slice()
    .sort((a, b) => (rank.get(a._id) ?? last) - (rank.get(b._id) ?? last))
    .map(publicWidget);
}

/** Replaces a widget's title and HTML; the id, creation time, and shared data are kept. */
export async function updateWidget(workspaceId: string, widgetId: string, input: GeneratedWidget): Promise<Widget | null> {
  checkWorkspaceId(workspaceId);
  const title = checkedTitle(input.title);
  const html = checkedHtml(input.html);
  const db = await getDatabase();
  const result = await db.collection<WidgetRecord>("widgets").findOneAndUpdate(
    { _id: widgetId, workspaceId },
    { $set: { title, html } },
    { returnDocument: "after" },
  );
  return result ? publicWidget(result) : null;
}

/** Stores the admin's tab order. Every id must belong to the workspace. */
export async function setWidgetOrder(workspaceId: string, ids: string[]): Promise<boolean> {
  checkWorkspaceId(workspaceId);
  const db = await getDatabase();
  const owned = await db.collection<WidgetRecord>("widgets").find({ workspaceId }, { projection: { _id: 1 } }).toArray();
  const ownedIds = new Set(owned.map((record) => record._id));
  const unique = Array.from(new Set(ids));
  if (unique.length !== ids.length || !unique.every((id) => ownedIds.has(id))) return false;
  await db.collection<WorkspaceRecord>("workspaces").updateOne({ _id: workspaceId }, { $set: { widgetOrder: unique } });
  return true;
}

export async function getWidget(workspaceId: string, widgetId: string): Promise<Widget | null> {
  checkWorkspaceId(workspaceId);
  const db = await getDatabase();
  const record = await db.collection<WidgetRecord>("widgets").findOne({ _id: widgetId, workspaceId });
  return record ? publicWidget(record) : null;
}

export const SPAN_LIMITS = { minCols: 3, maxCols: 12, minRows: 4, maxRows: 40 } as const;

function checkedSpan(span: unknown): WidgetSpan {
  const { cols, rows } = (span ?? {}) as Partial<WidgetSpan>;
  if (!Number.isInteger(cols) || !Number.isInteger(rows) ||
      (cols as number) < SPAN_LIMITS.minCols || (cols as number) > SPAN_LIMITS.maxCols ||
      (rows as number) < SPAN_LIMITS.minRows || (rows as number) > SPAN_LIMITS.maxRows) {
    throw new DatabaseError("INVALID_INPUT", `Widget span must be ${SPAN_LIMITS.minCols}-${SPAN_LIMITS.maxCols} columns and ${SPAN_LIMITS.minRows}-${SPAN_LIMITS.maxRows} rows.`);
  }
  return { cols: cols as number, rows: rows as number };
}

/** Updates the gallery preset size and/or the exact drag-resized span. */
export async function updateWidgetLayout(
  workspaceId: string, widgetId: string, input: { size?: WidgetSize; span?: WidgetSpan },
): Promise<Widget | null> {
  checkWorkspaceId(workspaceId);
  const changes: Partial<WidgetRecord> = {};
  if (input.size !== undefined) changes.size = checkedWidgetSize(input.size, "medium");
  if (input.span !== undefined) changes.span = checkedSpan(input.span);
  if (Object.keys(changes).length === 0) throw new DatabaseError("INVALID_INPUT", "Provide a size or span.");
  const db = await getDatabase();
  // Choosing a preset discards any drag-resized footprint so the preset takes effect.
  const update: UpdateFilter<WidgetRecord> = input.size !== undefined && input.span === undefined
    ? { $set: changes, $unset: { span: true } }
    : { $set: changes };
  const record = await db.collection<WidgetRecord>("widgets").findOneAndUpdate(
    { _id: widgetId, workspaceId }, update, { returnDocument: "after" },
  );
  return record ? publicWidget(record) : null;
}

export async function updateWidgetSize(workspaceId: string, widgetId: string, size: WidgetSize): Promise<Widget | null> {
  return updateWidgetLayout(workspaceId, widgetId, { size });
}

export async function deleteWidget(workspaceId: string, widgetId: string): Promise<boolean> {
  checkWorkspaceId(workspaceId);
  const db = await getDatabase();
  const result = await db.collection<WidgetRecord>("widgets").deleteOne({ _id: widgetId, workspaceId });
  if (result.deletedCount === 0) return false;
  await db.collection<WidgetDataRecord>("widgetData").deleteMany({ workspaceId, widgetId });
  return true;
}

export async function listTasks(workspaceId: string): Promise<Task[]> {
  checkWorkspaceId(workspaceId);
  const db = await getDatabase();
  const records = await db.collection<TaskRecord>("tasks").find({ workspaceId }).sort({ createdAt: 1, _id: 1 }).toArray();
  return records.map(publicTask);
}

export async function createTask(
  workspaceId: string,
  input: { title: string; description?: string; dueDate?: string; dueTime?: string; status?: TaskStatus },
): Promise<Task> {
  checkWorkspaceId(workspaceId);
  if (input.dueTime !== undefined && !input.dueDate) throw new DatabaseError("INVALID_INPUT", "A due time requires a due date.");
  await getWorkspacePlan(workspaceId); // throws NOT_FOUND for unknown workspaces
  const now = new Date();
  const record: TaskRecord = {
    _id: randomUUID(),
    workspaceId,
    title: checkedTitle(input.title),
    ...(input.description === undefined ? {} : { description: checkedDescription(input.description) }),
    ...(input.dueDate === undefined ? {} : { dueDate: checkedDueDate(input.dueDate) }),
    ...(input.dueTime === undefined ? {} : { dueTime: checkedDueTime(input.dueTime) }),
    status: checkedStatus(input.status),
    createdAt: now,
    updatedAt: now,
  };
  const db = await getDatabase();
  await db.collection<TaskRecord>("tasks").insertOne(record);
  return publicTask(record);
}

export async function updateTask(workspaceId: string, taskId: string, input: UpdateTaskRequest): Promise<Task | null> {
  checkWorkspaceId(workspaceId);
  checkTaskId(taskId);
  const changes: Partial<Pick<TaskRecord, "title" | "description" | "dueDate" | "dueTime" | "status">> & { updatedAt: Date } = { updatedAt: new Date() };
  if (input.title !== undefined) changes.title = checkedTitle(input.title);
  if (input.description !== undefined) changes.description = checkedDescription(input.description);
  const clearDueDate = input.dueDate === null || input.dueDate === "";
  if (typeof input.dueDate === "string" && !clearDueDate) changes.dueDate = checkedDueDate(input.dueDate);
  const clearDueTime = clearDueDate || input.dueTime === null || input.dueTime === "";
  if (typeof input.dueTime === "string" && !clearDueTime) changes.dueTime = checkedDueTime(input.dueTime);
  if (input.status !== undefined) changes.status = checkedStatus(input.status);
  const db = await getDatabase();
  const record = await db.collection<TaskRecord>("tasks").findOneAndUpdate(
    { _id: taskId, workspaceId },
    { $set: changes, ...((clearDueDate || clearDueTime) ? { $unset: { ...(clearDueDate ? { dueDate: "" } : {}), ...(clearDueTime ? { dueTime: "" } : {}) } } : {}) },
    { returnDocument: "after" },
  );
  return record ? publicTask(record) : null;
}

export async function deleteTask(workspaceId: string, taskId: string): Promise<boolean> {
  checkWorkspaceId(workspaceId);
  checkTaskId(taskId);
  const db = await getDatabase();
  return (await db.collection<TaskRecord>("tasks").deleteOne({ _id: taskId, workspaceId })).deletedCount === 1;
}
