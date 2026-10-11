import { compare, hash } from "bcryptjs";
import { checkOrigin, failure, HttpError, onlyFields, readJsonObject, success } from "@/lib/auth/http";
import { setSession } from "@/lib/auth/session";
import { trySetMonetizationSessionCookies } from "@/lib/billing/monetization-session";
import { BCRYPT_COST } from "@/lib/auth/usernames";
import { clearRateLimit, clientKey, enforceRateLimit } from "@/lib/auth/rate-limit";
import { getUserByUsername, getWorkspaceForUser, listWorkspacesForUser, publicAccount } from "@/lib/db/accounts";

export const runtime = "nodejs";

// Compared against when the username is unknown so timing does not reveal existence.
const DUMMY_HASH = hash("workspacezero-dummy-password", BCRYPT_COST);

export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const body = await readJsonObject(request);
    onlyFields(body, ["username", "password"]);
    const username = typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!username || !password) throw new HttpError(400, "INVALID_INPUT", "Username and password are required.");
    const bucket = `login:${clientKey(request)}:${username.slice(0, 32)}`;
    enforceRateLimit(bucket);

    const user = await getUserByUsername(username);
    const ok = user ? await compare(password, user.passwordHash) : (await compare(password, await DUMMY_HASH), false);
    if (!user || !ok) throw new HttpError(401, "UNAUTHENTICATED", "Username or password is incorrect.");
    clearRateLimit(bucket);

    // Most recently used accessible workspace, else the first one the user belongs to.
    const remembered = user.lastWorkspaceId ? await getWorkspaceForUser(user.lastWorkspaceId, user._id) : null;
    const workspace = remembered ?? (await listWorkspacesForUser(user._id))[0] ?? null;
    await setSession({ userId: user._id, activeWorkspaceId: workspace?.id });
    await trySetMonetizationSessionCookies(user._id, request);
    return success({ account: publicAccount(user), workspace });
  } catch (error) { return failure(error); }
}
