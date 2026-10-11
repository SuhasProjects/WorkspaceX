import { checkOrigin, failure, HttpError, success } from "@/lib/auth/http";
import { requireUser } from "@/lib/auth/session";
import { acceptInvitation, getInvitation, getWorkspacePlan } from "@/lib/db/accounts";
import { hasFeature } from "@/lib/billing/plans";
import { DatabaseError } from "@/lib/db/client";

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

/** Rechecks status, expiry, workspace existence, and the owner's Team entitlement before joining. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const invitation = await ownInvitation(request, params);
    let plan;
    try { ({ plan } = await getWorkspacePlan(invitation.workspaceId)); }
    catch (error) {
      if (error instanceof DatabaseError && error.code === "NOT_FOUND") throw new HttpError(404, "NOT_FOUND", "That workspace no longer exists.");
      throw error;
    }
    if (!hasFeature(plan, "memberRole")) throw new HttpError(403, "PLAN_FEATURE_REQUIRED", "The workspace owner's plan no longer allows members.");
    const workspace = await acceptInvitation(invitation);
    return success({ workspace });
  } catch (error) {
    if (error instanceof DatabaseError && error.code === "CONFLICT") return failure(new HttpError(409, "CONFLICT", error.message));
    return failure(error);
  }
}
