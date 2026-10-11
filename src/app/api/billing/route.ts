import { countWidgets, getWorkspace } from "@/lib/db/repository";
import { failure, HttpError, success } from "@/lib/auth/http";
import { requireSession } from "@/lib/auth/session";
import { getBillingProvider } from "@/lib/billing/provider";
import { widgetLimitFor } from "@/lib/billing/plans";
import type { BillingSummary } from "@/types/contracts";

export const runtime = "nodejs";
/** Current plan, subscription state, and tool usage for the signed-in workspace. */
export async function GET() {
  try {
    const session = await requireSession();
    const workspace = await getWorkspace(session.workspaceId);
    if (!workspace) throw new HttpError(404, "NOT_FOUND", "Workspace not found.");
    const summary: BillingSummary = {
      plan: workspace.plan,
      subscription: workspace.subscription,
      widgetLimit: widgetLimitFor(workspace.plan),
      widgetCount: await countWidgets(session.workspaceId),
      checkoutAvailable: getBillingProvider().available,
    };
    return success(summary);
  } catch (error) { return failure(error); }
}
