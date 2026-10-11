import { deleteWidget, updateWidget, updateWidgetLayout } from "@/lib/db/repository";
import { checkOrigin, failure, HttpError, onlyFields, readJsonObject, success } from "@/lib/auth/http";
import { requireWorkspaceRole } from "@/lib/auth/session";
import { DatabaseError } from "@/lib/db/client";
import type { WidgetSize, WidgetSpan } from "@/types/contracts";

export const runtime = "nodejs";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    checkOrigin(request);
    const { workspace } = await requireWorkspaceRole("admin");
    const body = await readJsonObject(request);
    onlyFields(body, ["size", "span"]);
    if (body.size !== undefined && body.size !== "small" && body.size !== "medium" && body.size !== "large") {
      throw new HttpError(400, "INVALID_INPUT", "Widget size must be small, medium, or large.");
    }
    if (body.span !== undefined && (typeof body.span !== "object" || body.span === null)) {
      throw new HttpError(400, "INVALID_INPUT", "Widget span must be an object with cols and rows.");
    }
    const { id } = await params;
    const widget = await updateWidgetLayout(workspace.id, id, {
      ...(body.size !== undefined ? { size: body.size as WidgetSize } : {}),
      ...(body.span !== undefined ? { span: body.span as WidgetSpan } : {}),
    });
    if (!widget) throw new HttpError(404, "NOT_FOUND", "Widget not found.");
    return success({ widget });
  } catch (error) {
    if (error instanceof DatabaseError && error.code === "INVALID_INPUT") {
      return failure(new HttpError(400, "INVALID_INPUT", error.message));
    }
    return failure(error);
  }
}
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    checkOrigin(request);
    const { workspace } = await requireWorkspaceRole("admin");
    const { id } = await params;
    if (!(await deleteWidget(workspace.id, id))) throw new HttpError(404, "NOT_FOUND", "Widget not found.");
    return success({ success: true });
  } catch (error) { return failure(error); }
}
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    checkOrigin(request);
    const { workspace } = await requireWorkspaceRole("admin");
    const { id } = await params;
    const body = await readJsonObject(request, 256 * 1024);
    onlyFields(body, ["title", "html"]);
    if (typeof body.title !== "string" || typeof body.html !== "string") {
      throw new HttpError(400, "INVALID_INPUT", "Widget title and HTML are required.");
    }
    const widget = await updateWidget(workspace.id, id, { title: body.title, html: body.html });
    if (!widget) throw new HttpError(404, "NOT_FOUND", "Widget not found.");
    return success({ widget });
  } catch (error) {
    if (error instanceof DatabaseError && error.code === "INVALID_INPUT") {
      return failure(new HttpError(400, "INVALID_INPUT", error.message));
    }
    return failure(error);
  }
}
