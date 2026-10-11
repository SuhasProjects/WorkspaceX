import { countWidgets } from "@/lib/db/repository";
import { countOwnedWorkspaces, countTeamSeats, getGenerationCount, publicAccount } from "@/lib/db/accounts";
import { failure, success } from "@/lib/auth/http";
import { requireUser, requireWorkspace } from "@/lib/auth/session";
import { getBillingProvider } from "@/lib/billing/provider";
import { generationLimitFor, planDefinition, widgetLimitFor } from "@/lib/billing/plans";
import type { BillingSummary } from "@/types/contracts";

export const runtime = "nodejs";
/** The signed-in account's plan, subscription, and usage. Tool usage refers to the active workspace when one is selected. */
export async function GET() {
  try {
    const { user } = await requireUser();
    const account = publicAccount(user);
    const active = await requireWorkspace().catch(() => null);
    const summary: BillingSummary = {
      plan: account.plan,
      subscription: account.subscription,
      widgetLimit: widgetLimitFor(active?.workspace.plan ?? account.plan),
      widgetCount: active ? await countWidgets(active.workspace.id) : 0,
      generationLimit: generationLimitFor(account.plan),
      generationCount: await getGenerationCount(user._id),
      workspaceLimit: planDefinition(account.plan).workspaceLimit,
      ownedWorkspaces: await countOwnedWorkspaces(user._id),
      seatCount: await countTeamSeats(user._id),
      checkoutAvailable: getBillingProvider().available,
    };
    return success(summary);
  } catch (error) { return failure(error); }
}
