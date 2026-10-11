import "server-only";
import { HttpError } from "@/lib/auth/http";
import { getWorkspace } from "@/lib/db/repository";
import { hasFeature, type PlanFeature } from "./plans";

/**
 * Feature gates (shared widgets, member logins) are only enforced when
 * BILLING_ENFORCE_FEATURES=true. Tool and generation limits are always
 * enforced. This lets the free demo workspace keep working until billing
 * is live, without weakening the paid-plan checks.
 */
export function featureGatingEnabled(): boolean {
  return process.env.BILLING_ENFORCE_FEATURES === "true";
}

const FEATURE_LABELS: Record<PlanFeature, string> = {
  aiEdit: "Editing tools with AI",
  sharedWidgets: "Shared team widgets",
  memberRole: "Member access",
};

/** Throws 403 PLAN_FEATURE_REQUIRED when gating is on and the plan lacks the feature. */
export async function requireFeature(workspaceId: string, feature: PlanFeature): Promise<void> {
  if (!featureGatingEnabled()) return;
  const workspace = await getWorkspace(workspaceId);
  if (!workspace) throw new HttpError(404, "NOT_FOUND", "Workspace not found.");
  if (!hasFeature(workspace.plan, feature)) {
    throw new HttpError(403, "PLAN_FEATURE_REQUIRED", `${FEATURE_LABELS[feature]} requires a higher plan.`);
  }
}
