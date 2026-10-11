import { failure, success } from "@/lib/auth/http";
import { requireMembershipOf } from "@/lib/auth/session";
import { canManage } from "@/lib/auth/roles";
import { listMembers, listPendingInvitationsForWorkspace } from "@/lib/db/accounts";

export const runtime = "nodejs";
/** Any member sees the roster; pending invitations are included for owners and admins only. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { workspace, role } = await requireMembershipOf(id);
    const [members, invitations] = await Promise.all([
      listMembers(workspace.id),
      canManage(role) ? listPendingInvitationsForWorkspace(workspace.id) : Promise.resolve([]),
    ]);
    return success({ members, invitations });
  } catch (error) { return failure(error); }
}
