import { checkOrigin, failure, success } from "@/lib/auth/http";
import { clearSession } from "@/lib/auth/session";
import { clearMonetizationSessionCookies } from "@/lib/billing/monetization-session";

export const runtime = "nodejs";
/** Idempotent: clearing an absent session is still a success. */
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    await clearSession();
    await clearMonetizationSessionCookies();
    return success({ success: true });
  } catch (error) { return failure(error); }
}
