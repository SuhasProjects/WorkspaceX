import "server-only";
import { cookies } from "next/headers";
import { getMonetize } from "./aws-monetize";

export const PRICING_COOKIE = "mai_pricing_url";
export const PORTAL_COOKIE = "mai_billing_portal_url";
const SESSION_SECONDS = 60 * 60 * 8;

/**
 * Mints the hosted pricing page and billing portal sessions for a user who just signed in
 * and stores each full URL in a first-party cookie that the launcher buttons read.
 * Call once at login, never per request. The SDK signs with AWS credentials, so this must
 * run on the server. The cookies are deliberately not HttpOnly: the launcher reads them in
 * the browser. They are same-origin, SameSite=Strict, and expire with the app session.
 */
export async function setMonetizationSessionCookies(userId: string, origin: string): Promise<void> {
  if (!userId) throw new Error("setMonetizationSessionCookies: userId is required");
  const monetize = getMonetize();
  const [{ pricingUrl }, { billingPortalUrl }] = await Promise.all([
    monetize.createPricingSession(userId, {
      returnUrl: `${origin}/pricing?checkout=return`,
      refreshUrl: `${origin}/pricing?checkout=expired`,
      sessionDurationSeconds: SESSION_SECONDS,
    }),
    monetize.createBillingPortalSession(userId, {
      returnUrl: `${origin}/`,
      refreshUrl: `${origin}/?portal=expired`,
      sessionDurationSeconds: SESSION_SECONDS,
    }),
  ]);
  const options = { httpOnly: false, secure: process.env.NODE_ENV === "production", sameSite: "strict" as const, path: "/", maxAge: SESSION_SECONDS };
  const jar = await cookies();
  jar.set(PRICING_COOKIE, pricingUrl, options);
  jar.set(PORTAL_COOKIE, billingPortalUrl, options);
}

/** Mirror of the login hook, for sign-out. */
export async function clearMonetizationSessionCookies(): Promise<void> {
  const jar = await cookies();
  jar.delete(PRICING_COOKIE);
  jar.delete(PORTAL_COOKIE);
}

/**
 * Login must never fail because billing is unreachable, so the sign-in routes call this
 * wrapper: it logs and carries on, leaving the user without launcher cookies until next login.
 */
export async function trySetMonetizationSessionCookies(userId: string, request: Request): Promise<void> {
  try {
    await setMonetizationSessionCookies(userId, new URL(request.url).origin);
  } catch (error) {
    console.error("Could not start hosted billing sessions", error instanceof Error ? error.message : error);
  }
}
