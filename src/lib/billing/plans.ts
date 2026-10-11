import type { Plan, Subscription } from "@/types/contracts";

export interface PlanDefinition {
  id: Plan;
  name: string;
  priceMonthly: number;
  /** null means unlimited. */
  widgetLimit: number | null;
  tagline: string;
  features: string[];
}

export const PLANS: PlanDefinition[] = [
  { id: "free", name: "Free", priceMonthly: 0, widgetLimit: 3, tagline: "For trying things out.",
    features: ["3 AI-generated tools", "Shared workspace with tasks", "Admin and member roles", "Light and dark themes"] },
  { id: "pro", name: "Pro", priceMonthly: 5, widgetLimit: 20, tagline: "For small teams that ship.",
    features: ["20 AI-generated tools", "Everything in Free", "Edit tools with AI", "Priority generation"] },
  { id: "team", name: "Team", priceMonthly: 15, widgetLimit: null, tagline: "For teams that run on tools.",
    features: ["Unlimited tools", "Everything in Pro", "Style references across tools", "Early access to new features"] },
];

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
