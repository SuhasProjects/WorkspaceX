import { checkOrigin, failure, HttpError, onlyFields, readJsonObject, success } from "@/lib/auth/http";
import { requireMembershipOf } from "@/lib/auth/session";
import { checkedUsername } from "@/lib/auth/usernames";
import { createInvitation, getUserByUsername, getWorkspacePlan } from "@/lib/db/accounts";
import { hasFeature } from "@/lib/billing/plans";
import { DatabaseError } from "@/lib/db/client";

export const runtime = "nodejs";

/** Owner/admin invites an existing username. Requires the owner's plan to include members (Team). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    checkOrigin(request);
    const { id } = await params;
    const { workspace, user } = await requireMembershipOf(id, "admin");
    const body = await readJsonObject(request);
    onlyFields(body, ["username", "role"]);
    if (body.role !== "admin" && body.role !== "member") throw new HttpError(400, "INVALID_INPUT", "Role must be admin or member.");
    const { usernameNormalized } = checkedUsername(body.username);
    const { plan } = await getWorkspacePlan(workspace.id);
    if (!hasFeature(plan, "memberRole")) {
      throw new HttpError(403, "PLAN_FEATURE_REQUIRED", "Inviting members requires the workspace owner to be on the Team plan.");
    }
    const invitee = await getUserByUsername(usernameNormalized);
    if (!invitee) throw new HttpError(404, "NOT_FOUND", "No account has that username.");
    if (invitee._id === user._id) throw new HttpError(400, "INVALID_INPUT", "You are already in this workspace.");
    const invitation = await createInvitation({ workspaceId: workspace.id, invitedUserId: invitee._id, invitedByUserId: user._id, role: body.role });
    return success({ invitation }, 201);
  } catch (error) {
    if (error instanceof DatabaseError && error.code === "CONFLICT") return failure(new HttpError(409, "CONFLICT", error.message));
    return failure(error);
  }
}
