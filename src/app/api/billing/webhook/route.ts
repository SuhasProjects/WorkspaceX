import { setWorkspaceSubscription } from "@/lib/db/repository";
import { failure, HttpError, success } from "@/lib/auth/http";
import { BillingUnavailableError, getBillingProvider, type SubscriptionEvent } from "@/lib/billing/provider";

export const runtime = "nodejs";

/**
 * The only path that can activate a paid plan. The provider verifies the
 * request's signature before any database change; an unverifiable request
 * changes nothing. No session cookie is involved: this is called by the
 * billing service, not by a user.
 */
export async function POST(request: Request) {
  try {
    const event: SubscriptionEvent = await getBillingProvider().parseWebhook(request);
    const status = ({ activated: "active", renewed: "active", past_due: "past_due", canceled: "canceled" } as const)[event.type];
    // TODO when the real provider lands: record event.eventId and skip duplicates (idempotency).
    const workspace = await setWorkspaceSubscription(event.workspaceId, { plan: event.plan, status, externalId: event.externalId });
    if (!workspace) throw new HttpError(404, "NOT_FOUND", "Workspace not found.");
    return success({ success: true });
  } catch (error) {
    if (error instanceof BillingUnavailableError) return failure(new HttpError(501, "NOT_IMPLEMENTED", error.message));
    return failure(error);
  }
}
