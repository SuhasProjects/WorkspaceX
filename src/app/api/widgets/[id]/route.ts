import { deleteWidget } from "@/lib/db/repository";
import { checkOrigin, failure, HttpError, success } from "@/lib/auth/http";
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