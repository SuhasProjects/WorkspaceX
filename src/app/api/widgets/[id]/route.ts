import { deleteWidget, updateWidget } from "@/lib/db/repository";
import { checkOrigin, failure, HttpError, onlyFields, readJsonObject, success } from "@/lib/auth/http";
import { DatabaseError } from "@/lib/db/client";
import { requireSession } from "@/lib/auth/session";

export const runtime = "nodejs";
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    checkOrigin(request);
    const session = await requireSession("admin");
    const { id } = await params;
    if (!(await deleteWidget(session.workspaceId, id))) throw new HttpError(404, "NOT_FOUND", "Widget not found.");
    return success({ success: true });
  } catch (error) { return failure(error); }
}
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    checkOrigin(request);
    const session = await requireSession("admin");
    const { id } = await params;
    const body = await readJsonObject(request, 256 * 1024);
    onlyFields(body, ["title", "html"]);
    if (typeof body.title !== "string" || typeof body.html !== "string") {
      throw new HttpError(400, "INVALID_INPUT", "Widget title and HTML are required.");
    }
    const widget = await updateWidget(session.workspaceId, id, { title: body.title, html: body.html });
    if (!widget) throw new HttpError(404, "NOT_FOUND", "Widget not found.");
    return success({ widget });
  } catch (error) {
    if (error instanceof DatabaseError && error.code === "INVALID_INPUT") {
      return failure(new HttpError(400, "INVALID_INPUT", error.message));
    }
    return failure(error);
  }
}
