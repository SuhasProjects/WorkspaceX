import { countTeamSeats, setUserSubscription } from "@/lib/db/accounts";
import { checkOrigin, failure, HttpError, onlyFields, readJsonObject, success } from "@/lib/auth/http";
import { requireUser } from "@/lib/auth/session";
import { BillingUnavailableError, getBillingProvider } from "@/lib/billing/provider";

export const runtime = "nodejs";
/**
 * Starts a checkout for a paid plan on the signed-in account. This never
 * activates the plan: the account is marked "pending" and only a verified
 * provider webhook can mark it "active". Team seats are counted across every
 * workspace the account owns.
 */
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const { user } = await requireUser();
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
    const checkout = await provider.createCheckoutSession({ userId: user._id, plan: body.plan, seats: body.plan === "team" ? await countTeamSeats(user._id) : 1, returnUrl });
    await setUserSubscription(user._id, { plan: body.plan, status: "pending", externalId: checkout.sessionId });
    return success({ url: checkout.url });
  } catch (error) {
    if (error instanceof BillingUnavailableError) return failure(new HttpError(503, "SERVICE_UNAVAILABLE", error.message));
    return failure(error);
  }
}
