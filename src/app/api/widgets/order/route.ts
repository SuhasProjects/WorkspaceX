import { setWidgetOrder } from "@/lib/db/repository";
import { checkOrigin, failure, HttpError, onlyFields, readJsonObject, success } from "@/lib/auth/http";
import { requireWorkspaceRole } from "@/lib/auth/session";

export const runtime = "nodejs";
/** Saves the tab order for the workspace. Body: { ids: string[] } containing only this workspace's widget ids. */
export async function PATCH(request: Request) {
  try {
    checkOrigin(request);
    const { workspace } = await requireWorkspaceRole("admin");
    const body = await readJsonObject(request);
    onlyFields(body, ["ids"]);
    const ids = body.ids;
    if (!Array.isArray(ids) || ids.length > 200 || !ids.every((id) => typeof id === "string" && /^[0-9a-f-]{36}$/.test(id))) {
      throw new HttpError(400, "INVALID_INPUT", "ids must be a list of widget ids.");
    }
    if (!(await setWidgetOrder(workspace.id, ids as string[]))) {
      throw new HttpError(400, "INVALID_INPUT", "ids must be unique widgets of this workspace.");
    }
    return success({ success: true });
  } catch (error) { return failure(error); }
}
