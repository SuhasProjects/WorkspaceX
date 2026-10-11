import { randomBytes } from "node:crypto";
import { checkOrigin, failure, HttpError, onlyFields, readJsonObject, success } from "@/lib/auth/http";
import { requireUser, setSession } from "@/lib/auth/session";
import { countOwnedWorkspaces, createWorkspace, listWorkspacesForUser, setLastWorkspace, userPlan } from "@/lib/db/accounts";
import { planDefinition } from "@/lib/billing/plans";
import { DatabaseError } from "@/lib/db/client";

export const runtime = "nodejs";

function workspaceSlug(name: string): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "workspace";
  return `${base}-${randomBytes(3).toString("hex")}`;
}

/** Every workspace the user owns or has joined. */
export async function GET() {
  try {
    const { user } = await requireUser();
    return success({ workspaces: await listWorkspacesForUser(user._id) });
  } catch (error) { return failure(error); }
}

/** Creates a workspace the user owns, within the account plan's ownership limit, and makes it active. */
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const { user } = await requireUser();
    const body = await readJsonObject(request);
    onlyFields(body, ["name", "workspaceId"]);
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name || name.length > 120) throw new HttpError(400, "INVALID_INPUT", "Provide a workspace name of 1 to 120 characters.");
    const id = body.workspaceId === undefined ? workspaceSlug(name) : body.workspaceId;
    if (typeof id !== "string" || !/^[a-z0-9-]{3,64}$/.test(id)) {
      throw new HttpError(400, "INVALID_INPUT", "Workspace ID must be 3 to 64 lowercase letters, digits, or hyphens.");
    }
    const plan = userPlan(user);
    const limit = planDefinition(plan).workspaceLimit;
    if (limit !== null && (await countOwnedWorkspaces(user._id)) >= limit) {
      throw new HttpError(403, "PLAN_LIMIT_REACHED", `The ${plan} plan allows ${limit} owned workspace${limit === 1 ? "" : "s"}. Upgrade to create more.`);
    }
    const workspace = await createWorkspace({ id, name, ownerUserId: user._id });
    await setLastWorkspace(user._id, workspace.id);
    await setSession({ userId: user._id, activeWorkspaceId: workspace.id });
    return success({ workspace }, 201);
  } catch (error) {
    if (error instanceof DatabaseError && error.code === "CONFLICT") return failure(new HttpError(409, "CONFLICT", "Workspace ID already exists."));
    if (error instanceof DatabaseError && error.code === "INVALID_INPUT") return failure(new HttpError(400, "INVALID_INPUT", error.message));
    return failure(error);
  }
}
