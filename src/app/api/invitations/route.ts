import { failure, success } from "@/lib/auth/http";
import { requireUser } from "@/lib/auth/session";
import { listPendingInvitationsForUser } from "@/lib/db/accounts";

export const runtime = "nodejs";
/** Pending invitations addressed to the signed-in user. */
export async function GET() {
  try {
    const { user } = await requireUser();
    return success({ invitations: await listPendingInvitationsForUser(user._id) });
  } catch (error) { return failure(error); }
}
