import { checkOrigin, failure, success } from "@/lib/auth/http";
import { clearSession } from "@/lib/auth/session";

export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    await clearSession();
    return success({ success: true });
  } catch (error) { return failure(error); }
}