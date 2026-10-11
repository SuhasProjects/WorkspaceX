import { randomBytes } from "node:crypto";
import { hash } from "bcryptjs";
import { checkOrigin, failure, HttpError, onlyFields, readJsonObject, success } from "@/lib/auth/http";
import { setSession } from "@/lib/auth/session";
import { BCRYPT_COST, checkedPassword, checkedUsername } from "@/lib/auth/usernames";
import { clientKey, enforceRateLimit } from "@/lib/auth/rate-limit";
import { createUser, createWorkspace, publicAccount, setLastWorkspace } from "@/lib/db/accounts";
import { DatabaseError } from "@/lib/db/client";

export const runtime = "nodejs";

export function workspaceSlug(name: string): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "workspace";
  return `${base}-${randomBytes(3).toString("hex")}`;
}

/** Open signup: creates the account, its first workspace, the owner membership, and a session. */
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    enforceRateLimit(`register:${clientKey(request)}`);
    const body = await readJsonObject(request);
    onlyFields(body, ["username", "password", "workspaceName"]);
    const { username, usernameNormalized } = checkedUsername(body.username);
    const password = checkedPassword(body.password);
    const workspaceName = typeof body.workspaceName === "string" ? body.workspaceName.trim() : "";
    if (!workspaceName || workspaceName.length > 120) throw new HttpError(400, "INVALID_INPUT", "Give your first workspace a name of 1 to 120 characters.");
    const user = await createUser({ username, usernameNormalized, passwordHash: await hash(password, BCRYPT_COST) });
    const workspace = await createWorkspace({ id: workspaceSlug(workspaceName), name: workspaceName, ownerUserId: user._id });
    await setLastWorkspace(user._id, workspace.id);
    await setSession({ userId: user._id, activeWorkspaceId: workspace.id });
    return success({ account: publicAccount(user), workspace }, 201);
  } catch (error) {
    if (error instanceof DatabaseError && error.code === "CONFLICT") return failure(new HttpError(409, "CONFLICT", error.message));
    if (error instanceof DatabaseError && error.code === "INVALID_INPUT") return failure(new HttpError(400, "INVALID_INPUT", error.message));
    return failure(error);
  }
}
