import "server-only";
import { MonetizationAI } from "@aws-app-monetization/sdk";
import { config as loadEnv } from "dotenv";

let sdk: MonetizationAI | null = null;

/**
 * Lazy accessor: the SDK constructor validates the app id, and env vars are absent during
 * `next build`, so constructing at module load would fail the build.
 * `.env.monetization` is not auto-loaded by Next.js; dotenv only fills keys that are not
 * already set, so real environment variables (production) still win.
 */
export function getMonetize(): MonetizationAI {
  if (!sdk) {
    loadEnv({ path: ".env.monetization", quiet: true });
    // The app id (bare id or ARN) is the only connection input. Live vs sandbox is decided
    // by whether MONETIZATION_APP_ID ends in "/sandbox"; endpoint and region come from
    // MONETIZATION_ENDPOINT, which the SDK reads itself.
    sdk = new MonetizationAI({ appId: process.env.MONETIZATION_APP_ID ?? "" });
  }
  return sdk;
}

/** Entitlement gating can be switched off while metering is being verified. Default: on. */
export function monetizationEnforced(): boolean {
  loadEnv({ path: ".env.monetization", quiet: true });
  return process.env.MONETIZATION_ENFORCE !== "false";
}

/** The action name used for metering and entitlement checks; must match the metric's sourceEventType. */
export const AI_GENERATION_EVENT = "ai_generation";
