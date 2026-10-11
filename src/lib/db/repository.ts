import "server-only";
import { randomUUID } from "node:crypto";
import { MongoServerError } from "mongodb";
import type { GeneratedWidget, JsonValue, Task, Widget } from "@/types/contracts";
import { DatabaseError, getDatabase } from "./client";

interface WorkspaceRecord {
  _id: string;
  name: string;
  adminPasswordHash: string;
  memberPasswordHash: string;
  tasks: Task[];
  createdAt: Date;
}
interface WidgetRecord {
  _id: string;
  workspaceId: string;
  title: string;
  html: string;
  createdAt: Date;
}
interface WidgetDataRecord {
  workspaceId: string;
  widgetId: string;
  key: string;
  value: JsonValue;
  updatedAt: Date;
}
export interface WorkspaceSummary { id: string; name: string }
export interface CreateWorkspaceRecord {
  id: string;
  name: string;
  adminPasswordHash: string;
  memberPasswordHash: string;
}

function checkWorkspaceId(id: string): void {
  if (!/^[a-z0-9-]{3,64}$/.test(id)) {
    throw new DatabaseError("INVALID_INPUT", "Invalid workspace ID.");
  }
}
function checkedTitle(title: string): string {
  const result = title.trim();
  if (!result || result.length > 120) throw new DatabaseError("INVALID_INPUT", "Title must contain 1 to 120 characters.");
  return result;
}
function publicWidget(record: WidgetRecord): Widget {
  return { id: record._id, title: record.title, html: record.html, createdAt: record.createdAt.toISOString() };
}

/** Caller must hash passwords using the authentication library before insertion. */
export async function createWorkspace(input: CreateWorkspaceRecord): Promise<WorkspaceSummary> {
  checkWorkspaceId(input.id);
  const name = checkedTitle(input.name);
  if (!input.adminPasswordHash || !input.memberPasswordHash || input.adminPasswordHash === input.memberPasswordHash) {
    throw new DatabaseError("INVALID_INPUT", "Distinct password hashes are required.");
  }
  const db = await getDatabase();
  try {
    await db.collection<WorkspaceRecord>("workspaces").insertOne({
      _id: input.id, name,
      adminPasswordHash: input.adminPasswordHash,
      memberPasswordHash: input.memberPasswordHash,
      tasks: [], createdAt: new Date(),
    });
  } catch (error) {
    if (error instanceof MongoServerError && error.code === 11000) {
      throw new DatabaseError("CONFLICT", "Workspace ID already exists.");
    }
    throw error;
  }
  return { id: input.id, name };
}

export async function getWorkspace(workspaceId: string): Promise<WorkspaceSummary | null> {
  checkWorkspaceId(workspaceId);
  const db = await getDatabase();
  const record = await db.collection<WorkspaceRecord>("workspaces").findOne(
    { _id: workspaceId }, { projection: { _id: 1, name: 1 } },
  );
  return record ? { id: record._id, name: record.name } : null;
}

/** Server authentication code only. This object must never be an API response. */
export async function getWorkspaceCredentials(workspaceId: string) {
  checkWorkspaceId(workspaceId);
  const db = await getDatabase();
  const record = await db.collection<WorkspaceRecord>("workspaces").findOne(
    { _id: workspaceId },
    { projection: { _id: 1, name: 1, adminPasswordHash: 1, memberPasswordHash: 1 } },
  );
  return record ? {
    id: record._id, name: record.name,
    adminPasswordHash: record.adminPasswordHash,
    memberPasswordHash: record.memberPasswordHash,
  } : null;
}

/** HTTP callers must pass workspace identity from a verified admin session. */
export async function createWidget(workspaceId: string, input: GeneratedWidget): Promise<Widget> {
  checkWorkspaceId(workspaceId);
  const title = checkedTitle(input.title);
  if (Buffer.byteLength(input.html, "utf8") > 200 * 1024 ||
      !/<!doctype\s+html\s*>/i.test(input.html) || !/<html[\s>]/i.test(input.html) ||
      !/<body[\s>]/i.test(input.html) || !/<\/html\s*>/i.test(input.html)) {
    throw new DatabaseError("INVALID_INPUT", "A complete HTML document of at most 200 KiB is required.");
  }
  if (!(await getWorkspace(workspaceId))) throw new DatabaseError("NOT_FOUND", "Workspace not found.");
  const db = await getDatabase();
  const record: WidgetRecord = { _id: randomUUID(), workspaceId, title, html: input.html, createdAt: new Date() };
  await db.collection<WidgetRecord>("widgets").insertOne(record);
  return publicWidget(record);
}

export async function listWidgets(workspaceId: string): Promise<Widget[]> {
  checkWorkspaceId(workspaceId);
  const db = await getDatabase();
  const records = await db.collection<WidgetRecord>("widgets").find({ workspaceId }).sort({ createdAt: 1, _id: 1 }).toArray();
  return records.map(publicWidget);
}

export async function getWidget(workspaceId: string, widgetId: string): Promise<Widget | null> {
  checkWorkspaceId(workspaceId);
  const db = await getDatabase();
  const record = await db.collection<WidgetRecord>("widgets").findOne({ _id: widgetId, workspaceId });
  return record ? publicWidget(record) : null;
}

export async function deleteWidget(workspaceId: string, widgetId: string): Promise<boolean> {
  checkWorkspaceId(workspaceId);
  const db = await getDatabase();
  const result = await db.collection<WidgetRecord>("widgets").deleteOne({ _id: widgetId, workspaceId });
  if (result.deletedCount === 0) return false;
  await db.collection<WidgetDataRecord>("widgetData").deleteMany({ workspaceId, widgetId });
  return true;
}