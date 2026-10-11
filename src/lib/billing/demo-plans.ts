import type { Plan } from "@/types/contracts";

/**
 * HACKATHON DEMO ONLY. Accounts with these exact usernames are treated as if
 * a verified payment had activated the plan, so the recording can show paid
 * features without a billing provider. Delete this file (and its two call
 * sites in src/lib/db/accounts.ts) before real billing goes live.
 */
export const DEMO_PLAN_OVERRIDES: Record<string, Plan> = {
  "demo-team": "team",
  "demo-pro": "pro",
};

export function demoPlanFor(usernameNormalized: string | undefined): Plan | null {
  return usernameNormalized ? DEMO_PLAN_OVERRIDES[usernameNormalized] ?? null : null;
}
