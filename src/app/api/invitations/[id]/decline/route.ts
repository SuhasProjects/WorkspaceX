import { checkOrigin, failure, HttpError, success } from "@/lib/auth/http";
import { requireUser } from "@/lib/auth/session";
import { getInvitation, setInvitationStatus } from "@/lib/db/accounts";

export const runtime = "nodejs";

async function ownInvitation(request: Request, params: Promise<{ id: string }>) {
  checkOrigin(request);
  const { id } = await params;
  const { user } = await requireUser();
  const invitation = /^[0-9a-f-]{36}$/.test(id) ? await getInvitation(id) : null;
  // Other users' invitations look nonexistent, not forbidden.
  if (!invitation || invitation.invitedUserId !== user._id) throw new HttpError(404, "NOT_FOUND", "Invitation not found.");
  if (invitation.status !== "pending" || invitation.expiresAt.getTime() <= Date.now()) {
    throw new HttpError(409, "CONFLICT", invitation.status === "pending" ? "This invitation has expired." : "This invitation is no longer pending.");
  }
  return invitation;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const invitation = await ownInvitation(request, params);
    await setInvitationStatus(invitation._id, "declined");
    return success({ success: true });
  } catch (error) { return failure(error); }
}
