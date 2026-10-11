import { deleteTask, updateTask } from "@/lib/db/repository";
import { checkOrigin, failure, HttpError, onlyFields, readJsonObject, success } from "@/lib/auth/http";
import { requireSession } from "@/lib/auth/session";
import { DatabaseError } from "@/lib/db/client";
import type { UpdateTaskRequest } from "@/types/contracts";

export const runtime = "nodejs";

function databaseFailure(error: unknown) {
  if (error instanceof DatabaseError && error.code === "INVALID_INPUT") return failure(new HttpError(400, error.code, error.message));
  return failure(error);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    checkOrigin(request);
    const session = await requireSession();
    const body = await readJsonObject(request);
    onlyFields(body, ["title", "description", "dueDate", "dueTime", "status"]);
    // Members may move a task between columns (status only); everything else is admin-only.
    if (session.role !== "admin" && Object.keys(body).some((key) => key !== "status")) {
      throw new HttpError(403, "FORBIDDEN", "Admin access is required to edit task details.");
    }
    if (!Object.keys(body).length || (body.title !== undefined && typeof body.title !== "string") ||
        (body.description !== undefined && typeof body.description !== "string") ||
        (body.dueDate !== undefined && body.dueDate !== null && typeof body.dueDate !== "string") ||
        (body.dueTime !== undefined && body.dueTime !== null && typeof body.dueTime !== "string") ||
        (body.status !== undefined && typeof body.status !== "string")) {
      throw new HttpError(400, "INVALID_INPUT", "Provide at least one valid task field.");
    }
    const { id } = await params;
    const task = await updateTask(session.workspaceId, id, body as UpdateTaskRequest);
    if (!task) throw new HttpError(404, "NOT_FOUND", "Task not found.");
    return success({ task });
  } catch (error) { return databaseFailure(error); }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    checkOrigin(request);
    const session = await requireSession("admin");
    const { id } = await params;
    if (!(await deleteTask(session.workspaceId, id))) throw new HttpError(404, "NOT_FOUND", "Task not found.");
    return success({ success: true });
  } catch (error) { return databaseFailure(error); }
}
