import { setWorkspaceSubscription } from "@/lib/db/repository";
import { checkOrigin, failure, HttpError, onlyFields, readJsonObject, success } from "@/lib/auth/http";
import { requireSession } from "@/lib/auth/session";
import { BillingUnavailableError, getBillingProvider } from "@/lib/billing/provider";

export const runtime = "nodejs";
/**
 * Starts a checkout for a paid plan. This never activates the plan: the
 * workspace is marked "pending" and only a verified provider webhook can mark
 * it "active".
 */
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const session = await requireSession("admin");
    const body = await readJsonObject(request);
    onlyFields(body, ["plan"]);
    if (body.plan !== "pro" && body.plan !== "team") {
      throw new HttpError(400, "INVALID_INPUT", "Choose the pro or team plan.");
    }
    const provider = getBillingProvider();
    if (!provider.available) {
      throw new HttpError(503, "SERVICE_UNAVAILABLE", "Paid plans are coming soon. Billing is not connected yet.");
    }
    const returnUrl = new URL("/pricing?checkout=return", request.url).toString();
    const checkout = await provider.createCheckoutSession({ workspaceId: session.workspaceId, plan: body.plan, returnUrl });
    await setWorkspaceSubscription(session.workspaceId, { plan: body.plan, status: "pending", externalId: checkout.sessionId });
    return success({ url: checkout.url });
  } catch (error) {
    if (error instanceof BillingUnavailableError) return failure(new HttpError(503, "SERVICE_UNAVAILABLE", error.message));
    return failure(error);
  }
}
