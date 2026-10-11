import { compare } from "bcryptjs";
import { getWorkspaceCredentials } from "@/lib/db/repository";
import { checkOrigin, failure, HttpError, onlyFields, readJsonObject, success } from "@/lib/auth/http";
import { setSession } from "@/lib/auth/session";

export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const body = await readJsonObject(request);
    onlyFields(body, ["workspaceId", "password"]);
    if (typeof body.workspaceId !== "string" || !/^[a-z0-9-]{3,64}$/.test(body.workspaceId) ||
        typeof body.password !== "string") {
      throw new HttpError(400, "INVALID_INPUT", "Workspace ID and password are required.");
    }
    const record = await getWorkspaceCredentials(body.workspaceId);
    const admin = record ? await compare(body.password, record.adminPasswordHash) : false;
    const member = record && !admin ? await compare(body.password, record.memberPasswordHash) : false;
    if (!record || (!admin && !member)) {
      throw new HttpError(401, "UNAUTHENTICATED", "Workspace ID or password is incorrect.");
    }
    const role = admin ? "admin" as const : "member" as const;
    await setSession({ workspaceId: record.id, role });
    return success({ workspace: { id: record.id, name: record.name, role } });
  } catch (error) { return failure(error); }
}