import { checkOrigin, failure, HttpError, onlyFields, readJsonObject, success } from "@/lib/auth/http";
import { requireMembershipOf } from "@/lib/auth/session";
import { getMembership, removeMember, updateMemberRole } from "@/lib/db/accounts";

export const runtime = "nodejs";

/** Owner only: promote or demote between admin and member. The owner cannot be changed here. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; userId: string }> }) {
  try {
    checkOrigin(request);
    const { id, userId } = await params;
    const { workspace } = await requireMembershipOf(id, "owner");
    const body = await readJsonObject(request);
    onlyFields(body, ["role"]);
    if (body.role !== "admin" && body.role !== "member") throw new HttpError(400, "INVALID_INPUT", "Role must be admin or member.");
    const target = await getMembership(workspace.id, userId);
    if (!target) throw new HttpError(404, "NOT_FOUND", "Member not found.");
    if (target.role === "owner") throw new HttpError(403, "FORBIDDEN", "The owner's role cannot be changed.");
    await updateMemberRole(workspace.id, userId, body.role);
    return success({ success: true });
  } catch (error) { return failure(error); }
}

/** Owners remove anyone but themselves; admins remove ordinary members only. */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; userId: string }> }) {
  try {
    checkOrigin(request);
    const { id, userId } = await params;
    const { workspace, role, user } = await requireMembershipOf(id, "admin");
    const target = await getMembership(workspace.id, userId);
    if (!target) throw new HttpError(404, "NOT_FOUND", "Member not found.");
    if (target.role === "owner") throw new HttpError(403, "FORBIDDEN", "The owner cannot be removed.");
    if (role === "admin" && (target.role === "admin" || target.userId === user._id)) {
      throw new HttpError(403, "FORBIDDEN", "Admins can only remove members.");
    }
    if (!(await removeMember(workspace.id, userId))) throw new HttpError(404, "NOT_FOUND", "Member not found.");
    return success({ success: true });
  } catch (error) { return failure(error); }
}
