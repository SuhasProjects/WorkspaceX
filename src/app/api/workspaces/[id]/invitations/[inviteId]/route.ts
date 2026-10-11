import { checkOrigin, failure, HttpError, success } from "@/lib/auth/http";
import { requireMembershipOf } from "@/lib/auth/session";
import { getInvitation, setInvitationStatus } from "@/lib/db/accounts";

export const runtime = "nodejs";
/** Owner/admin revokes a pending invitation. */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; inviteId: string }> }) {
  try {
    checkOrigin(request);
    const { id, inviteId } = await params;
    const { workspace } = await requireMembershipOf(id, "admin");
    const invitation = /^[0-9a-f-]{36}$/.test(inviteId) ? await getInvitation(inviteId) : null;
    if (!invitation || invitation.workspaceId !== workspace.id) throw new HttpError(404, "NOT_FOUND", "Invitation not found.");
    if (!(await setInvitationStatus(invitation._id, "revoked"))) throw new HttpError(409, "CONFLICT", "This invitation is no longer pending.");
    return success({ success: true });
  } catch (error) { return failure(error); }
}
