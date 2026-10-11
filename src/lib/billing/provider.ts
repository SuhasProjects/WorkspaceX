import "server-only";
import type { Plan } from "@/types/contracts";

/**
 * Boundary between WorkspaceZero and whichever payment service we use.
 * Everything billing-specific lives behind this interface so the AWS
 * monetization service can replace the placeholder without touching routes,
 * the database layer, or the UI.
 */
export interface CheckoutSession {
  /** Where to send the admin to pay. */
  url: string;
  /** Provider's identifier for this checkout attempt, stored as the pending externalId. */
  sessionId: string;
}

export interface SubscriptionEvent {
  type: "activated" | "renewed" | "past_due" | "canceled";
  /** The paying account. Subscriptions belong to users, never to a single workspace. */
  userId: string;
  plan: Exclude<Plan, "free">;
  externalId: string;
  /** Provider event id, used for idempotency. */
  eventId: string;
}

export interface BillingProvider {
  readonly name: string;
  /** True when real checkouts can be started. */
  readonly available: boolean;
  createCheckoutSession(input: { userId: string; plan: Exclude<Plan, "free">; seats: number; returnUrl: string }): Promise<CheckoutSession>;
  /**
   * Verifies a webhook's authenticity (signature, timestamp) and turns it into
   * a SubscriptionEvent. Must throw on any verification failure.
   */
  parseWebhook(request: Request): Promise<SubscriptionEvent>;
}

export class BillingUnavailableError extends Error {
  constructor(message = "Billing is not available yet.") { super(message); this.name = "BillingUnavailableError"; }
}

/**
 * Placeholder used until the AWS service is connected. It can never start a
 * checkout or produce a verified event, so no paid plan can be activated
 * through it.
 */
const placeholderProvider: BillingProvider = {
  name: "placeholder",
  available: false,
  async createCheckoutSession() {
    throw new BillingUnavailableError("Paid plans are coming soon. Billing is not connected yet.");
  },
  async parseWebhook() {
    throw new BillingUnavailableError("Billing webhooks are not connected yet.");
  },
};

export function getBillingProvider(): BillingProvider {
  // When the AWS provider exists: `if (process.env.BILLING_PROVIDER === "aws") return awsProvider;`
  return placeholderProvider;
}
