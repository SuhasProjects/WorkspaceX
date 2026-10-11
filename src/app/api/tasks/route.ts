import { createTask, listTasks } from "@/lib/db/repository";
import { checkOrigin, failure, HttpError, onlyFields, readJsonObject, success } from "@/lib/auth/http";
import { requireSession } from "@/lib/auth/session";
import { DatabaseError } from "@/lib/db/client";

export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await requireSession();
    return success({ tasks: await listTasks(session.workspaceId) });
  } catch (error) { return failure(error); }
}

export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const session = await requireSession("admin");
    const body = await readJsonObject(request);
    onlyFields(body, ["title", "description", "status"]);
    if (typeof body.title !== "string" || (body.description !== undefined && typeof body.description !== "string") ||
        (body.status !== undefined && typeof body.status !== "string")) {
      throw new HttpError(400, "INVALID_INPUT", "A task title and valid optional fields are required.");
    }
    const task = await createTask(session.workspaceId, {
      title: body.title,
      ...(body.description === undefined ? {} : { description: body.description }),
      ...(body.status === undefined ? {} : { status: body.status as never }),
    });
    return success({ task }, 201);
  } catch (error) {
    if (error instanceof DatabaseError && error.code === "INVALID_INPUT") return failure(new HttpError(400, error.code, error.message));
    return failure(error);
  }
}
