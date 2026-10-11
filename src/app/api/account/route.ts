import { failure, success } from "@/lib/auth/http";
import { requireUser } from "@/lib/auth/session";
import { publicAccount } from "@/lib/db/accounts";

export const runtime = "nodejs";
export async function GET() {
  try {
    const { user } = await requireUser();
    return success({ account: publicAccount(user) });
  } catch (error) { return failure(error); }
}
