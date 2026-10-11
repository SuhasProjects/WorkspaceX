import { createWidget, listWidgets } from "@/lib/db/repository";
import { checkOrigin, failure, HttpError, onlyFields, readJsonObject, success } from "@/lib/auth/http";
import { requireSession } from "@/lib/auth/session";
import { DatabaseError } from "@/lib/db/client";
import type { WidgetSize } from "@/types/contracts";

export const runtime = "nodejs";
export async function GET() {
  try {
    const session = await requireSession();
    return success({ widgets: await listWidgets(session.workspaceId) });
  } catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const session = await requireSession("admin");
    const body = await readJsonObject(request, 256 * 1024);
    onlyFields(body, ["title", "html", "size"]);
    if (typeof body.title !== "string" || typeof body.html !== "string") {
      throw new HttpError(400, "INVALID_INPUT", "Widget title and HTML are required.");
    }
    return success({ widget: await createWidget(session.workspaceId, { title: body.title, html: body.html, ...(body.size === undefined ? {} : { size: body.size as WidgetSize }) }) }, 201);
  } catch (error) {
    if (error instanceof DatabaseError && error.code === "INVALID_INPUT") {
      return failure(new HttpError(400, "INVALID_INPUT", error.message));
    }
    if (error instanceof DatabaseError && error.code === "PLAN_LIMIT_REACHED") {
      return failure(new HttpError(403, "PLAN_LIMIT_REACHED", error.message));
    }
    return failure(error);
  }
}
