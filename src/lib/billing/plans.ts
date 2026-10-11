import type { Plan, Subscription } from "@/types/contracts";

export type PlanFeature = "aiEdit" | "sharedWidgets" | "memberRole";

export interface PlanDefinition {
  id: Plan;
  name: string;
  priceMonthly: number;
  /** Team plan: seats covered by the base price and the monthly price of each extra seat. */
  includedMembers?: number;
  extraMemberPrice?: number;
  tagline: string;
  /** Active tools; null means unlimited. Enforced server-side. */
  widgetLimit: number | null;
  /** AI generations (new tools and edits) per calendar month. Enforced server-side. */
  generationLimit: number;
  /** Display only until accounts exist: the app cannot count people or workspaces per customer yet. */
  memberLimit: number | null;
  workspaceLimit: number | null;
  features: Record<PlanFeature, boolean | "limited">;
}

export const PLANS: PlanDefinition[] = [
  { id: "free", name: "Free", priceMonthly: 0, tagline: "For trying things out.",
    widgetLimit: 3, generationLimit: 3, memberLimit: 1, workspaceLimit: 1,
    features: { aiEdit: "limited", sharedWidgets: false, memberRole: false } },
  { id: "pro", name: "Pro", priceMonthly: 12, tagline: "For individuals who build a lot.",
    widgetLimit: null, generationLimit: 20, memberLimit: 1, workspaceLimit: 3,
    features: { aiEdit: true, sharedWidgets: false, memberRole: false } },
  { id: "team", name: "Team", priceMonthly: 50, includedMembers: 10, extraMemberPrice: 25, tagline: "For teams that run on tools.",
    widgetLimit: null, generationLimit: 100, memberLimit: null, workspaceLimit: null,
    features: { aiEdit: true, sharedWidgets: true, memberRole: true } },
];

/** Rows of the comparison table on the pricing page, in display order. */
export const PLAN_ROWS: { label: string; value: (plan: PlanDefinition) => string | boolean }[] = [
  { label: "Price", value: (plan) => priceLabel(plan) },
  { label: "AI generations / month", value: (plan) => String(plan.generationLimit) },
  { label: "Active tools", value: (plan) => plan.widgetLimit === null ? "Unlimited" : String(plan.widgetLimit) },
  { label: "Team members", value: (plan) => plan.memberLimit === null ? "Unlimited" : String(plan.memberLimit) },
  { label: "Workspaces", value: (plan) => plan.workspaceLimit === null ? "Unlimited" : String(plan.workspaceLimit) },
  { label: "Edit existing widgets with AI", value: (plan) => plan.features.aiEdit === "limited" ? "Limited" : plan.features.aiEdit },
  { label: "Shared team widgets", value: (plan) => plan.features.sharedWidgets },
  { label: "Workspace permissions", value: (plan) => plan.features.memberRole ? "Admin + Member" : false },
];

/** "$50/mo for 10 members, +$25/mo each extra" style label. */
export function priceLabel(plan: PlanDefinition): string {
  if (plan.includedMembers && plan.extraMemberPrice) {
    return `$${plan.priceMonthly}/mo for ${plan.includedMembers} members, +$${plan.extraMemberPrice}/mo per extra member`;
  }
  return `$${plan.priceMonthly}/mo`;
}

/** Monthly price for a given seat count; non-seat plans ignore the count. */
export function monthlyPriceFor(plan: PlanDefinition, members = 1): number {
  if (!plan.includedMembers || !plan.extraMemberPrice) return plan.priceMonthly;
  return plan.priceMonthly + Math.max(0, members - plan.includedMembers) * plan.extraMemberPrice;
}

export function planDefinition(plan: Plan): PlanDefinition {
  return PLANS.find((candidate) => candidate.id === plan) ?? PLANS[0];
}

/** The plan a workspace is entitled to right now. Anything not actively paid for falls back to Free. */
export function effectivePlan(subscription: Pick<Subscription, "plan" | "status"> | undefined): Plan {
  if (!subscription || subscription.plan === "free") return "free";
  return subscription.status === "active" ? subscription.plan : "free";
}

export function widgetLimitFor(plan: Plan): number | null {
  return planDefinition(plan).widgetLimit;
}

export function generationLimitFor(plan: Plan): number {
  return planDefinition(plan).generationLimit;
}

export function hasFeature(plan: Plan, feature: PlanFeature): boolean {
  return planDefinition(plan).features[feature] !== false;
}

/** Calendar month key used for generation counting, e.g. "2026-10". */
export function usageMonth(date = new Date()): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}
