import { failure, success } from "@/lib/auth/http";
import { requireWorkspace } from "@/lib/auth/session";

export const runtime = "nodejs";
/** The selected workspace with the user's current role and the owner's effective plan. */
export async function GET() {
  try {
    const { workspace } = await requireWorkspace();
    return success({ workspace });
  } catch (error) { return failure(error); }
}
