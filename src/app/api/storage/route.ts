import { checkOrigin, failure, onlyFields, readJsonObject, success } from "@/lib/auth/http";
import { requireWorkspace } from "@/lib/auth/session";
import { requireFeature } from "@/lib/billing/entitlements";
import { readShared, writeShared } from "@/lib/db/storage";

export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const { workspace } = await requireWorkspace();
    await requireFeature(workspace.id, "sharedWidgets");
    const params = new URL(request.url).searchParams;
    return success(await readShared(workspace.id, params.get("widgetId"), params.get("key")));
  } catch (error) { return failure(error); }
}
export async function PUT(request: Request) {
  try {
    checkOrigin(request);
    const { workspace } = await requireWorkspace();
    await requireFeature(workspace.id, "sharedWidgets");
    const body = await readJsonObject(request, 70 * 1024);
    onlyFields(body, ["widgetId", "key", "value"]);
    await writeShared(workspace.id, body.widgetId, body.key, body.value);
    return success({ success: true });
  } catch (error) { return failure(error); }
}