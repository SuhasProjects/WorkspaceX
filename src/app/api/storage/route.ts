import { checkOrigin, failure, onlyFields, readJsonObject, success } from "@/lib/auth/http";
import { requireSession } from "@/lib/auth/session";
import { readShared, writeShared } from "@/lib/db/storage";

export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const session = await requireSession();
    const params = new URL(request.url).searchParams;
    return success(await readShared(session.workspaceId, params.get("widgetId"), params.get("key")));
  } catch (error) { return failure(error); }
}
export async function PUT(request: Request) {
  try {
    checkOrigin(request);
    const session = await requireSession();
    const body = await readJsonObject(request, 70 * 1024);
    onlyFields(body, ["widgetId", "key", "value"]);
    await writeShared(session.workspaceId, body.widgetId, body.key, body.value);
    return success({ success: true });
  } catch (error) { return failure(error); }
}