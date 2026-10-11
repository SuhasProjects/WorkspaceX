import { checkOrigin, failure, success } from "@/lib/auth/http";
import { requireMembershipOf, setSession } from "@/lib/auth/session";
import { setLastWorkspace } from "@/lib/db/accounts";

export const runtime = "nodejs";
/** Switches the session's active workspace. Non-members get 404. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    checkOrigin(request);
    const { id } = await params;
    const { user, workspace } = await requireMembershipOf(id);
    await setLastWorkspace(user._id, workspace.id);
    await setSession({ userId: user._id, activeWorkspaceId: workspace.id });
    return success({ workspace });
  } catch (error) { return failure(error); }
}
