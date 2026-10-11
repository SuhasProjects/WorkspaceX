import { randomBytes } from "node:crypto";
import { hash } from "bcryptjs";
import { createWorkspace } from "@/lib/db/repository";
import { checkOrigin, failure, HttpError, onlyFields, readJsonObject, success } from "@/lib/auth/http";
import { setSession } from "@/lib/auth/session";
import { DatabaseError } from "@/lib/db/client";

export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const body = await readJsonObject(request);
    onlyFields(body, ["name", "workspaceId", "adminPassword", "memberPassword"]);
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const adminPassword = body.adminPassword;
    const memberPassword = body.memberPassword;
    if (!name || name.length > 120 ||
        typeof adminPassword !== "string" || adminPassword.length < 12 || adminPassword.length > 128 ||
        typeof memberPassword !== "string" || memberPassword.length < 12 || memberPassword.length > 128 ||
        adminPassword === memberPassword) {
      throw new HttpError(400, "INVALID_INPUT", "Provide a name and distinct passwords of 12 to 128 characters.");
    }
    const generatedId = `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "workspace"}-${randomBytes(3).toString("hex")}`;
    const id = body.workspaceId === undefined ? generatedId : body.workspaceId;
    if (typeof id !== "string" || !/^[a-z0-9-]{3,64}$/.test(id)) {
      throw new HttpError(400, "INVALID_INPUT", "Workspace ID must be 3 to 64 lowercase letters, digits, or hyphens.");
    }
    const [adminPasswordHash, memberPasswordHash] = await Promise.all([hash(adminPassword, 12), hash(memberPassword, 12)]);
    const workspace = await createWorkspace({ id, name, adminPasswordHash, memberPasswordHash });
    await setSession({ workspaceId: id, role: "admin" });
    return success({ workspace: { ...workspace, role: "admin" as const } }, 201);
  } catch (error) {
    if (error instanceof DatabaseError && error.code === "CONFLICT") {
      return failure(new HttpError(409, "CONFLICT", "Workspace ID already exists."));
    }
    return failure(error);
  }
}