import { getWorkspace } from "@/lib/db/repository";
import { failure, HttpError, success } from "@/lib/auth/http";
import { requireSession } from "@/lib/auth/session";

export const runtime = "nodejs";
export async function GET() {
  try {
    const session = await requireSession();
    const workspace = await getWorkspace(session.workspaceId);
    if (!workspace) throw new HttpError(404, "NOT_FOUND", "Workspace not found.");
    return success({ workspace: { ...workspace, role: session.role } });
  } catch (error) { return failure(error); }
}