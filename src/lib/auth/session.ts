import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import type { WorkspaceRole, WorkspaceSummary } from "@/types/contracts";
import { HttpError } from "./http";
import { hasRole } from "./roles";
import { getUserById, getWorkspaceForUser, type UserRecord } from "@/lib/db/accounts";

const COOKIE_NAME = "wz_session";
const SESSION_SECONDS = 60 * 60 * 24 * 7;

export interface SessionClaims { userId: string; activeWorkspaceId?: string }

function signingKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new HttpError(503, "SERVICE_UNAVAILABLE", "Session configuration is incomplete.");
  return new TextEncoder().encode(secret);
}

const cookieOptions = () => ({
  httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/",
});

/** Writes (or rotates) the session cookie. */
export async function setSession(claims: SessionClaims): Promise<void> {
  const token = await new SignJWT({ userId: claims.userId, ...(claims.activeWorkspaceId ? { activeWorkspaceId: claims.activeWorkspaceId } : {}) })
    .setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime(`${SESSION_SECONDS}s`).sign(signingKey());
  (await cookies()).set(COOKIE_NAME, token, { ...cookieOptions(), maxAge: SESSION_SECONDS });
}

export async function clearSession(): Promise<void> {
  (await cookies()).set(COOKIE_NAME, "", { ...cookieOptions(), maxAge: 0 });
}

async function readClaims(): Promise<SessionClaims> {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) throw new HttpError(401, "UNAUTHENTICATED", "Sign in to continue.");
  let payload: Record<string, unknown>;
  try {
    payload = (await jwtVerify(token, signingKey(), { algorithms: ["HS256"] })).payload as Record<string, unknown>;
  } catch { throw new HttpError(401, "UNAUTHENTICATED", "Session expired or invalid."); }
  const { userId, activeWorkspaceId } = payload;
  if (typeof userId !== "string" || !/^[0-9a-f-]{36}$/.test(userId)) throw new HttpError(401, "UNAUTHENTICATED", "Session expired or invalid.");
  if (activeWorkspaceId !== undefined && (typeof activeWorkspaceId !== "string" || !/^[a-z0-9-]{3,64}$/.test(activeWorkspaceId))) {
    throw new HttpError(401, "UNAUTHENTICATED", "Session expired or invalid.");
  }
  return { userId, activeWorkspaceId: activeWorkspaceId as string | undefined };
}

export interface UserContext { claims: SessionClaims; user: UserRecord }
export interface WorkspaceContext extends UserContext { workspace: WorkspaceSummary; role: WorkspaceRole }

/** Verifies the cookie and loads the user. A deleted user gets 401. */
export async function requireUser(): Promise<UserContext> {
  const claims = await readClaims();
  const user = await getUserById(claims.userId);
  if (!user) throw new HttpError(401, "UNAUTHENTICATED", "Session expired or invalid.");
  return { claims, user };
}

/**
 * Loads the selected workspace and the user's *current* membership from the
 * database, so removals and role changes apply on the next request. When the
 * selection is missing or no longer accessible, the cookie's selection is
 * cleared and the client gets NO_ACTIVE_WORKSPACE to pick another.
 */
export async function requireWorkspace(): Promise<WorkspaceContext> {
  const context = await requireUser();
  const workspaceId = context.claims.activeWorkspaceId;
  const workspace = workspaceId ? await getWorkspaceForUser(workspaceId, context.claims.userId) : null;
  if (!workspace) {
    await setSession({ userId: context.claims.userId });
    throw new HttpError(409, "NO_ACTIVE_WORKSPACE", "Select a workspace to continue.");
  }
  return { ...context, workspace, role: workspace.role };
}

/** `requireWorkspaceRole("admin")` admits owners and admins; `"owner"` admits owners only. */
export async function requireWorkspaceRole(required: WorkspaceRole): Promise<WorkspaceContext> {
  const context = await requireWorkspace();
  if (!hasRole(context.role, required)) {
    throw new HttpError(403, "FORBIDDEN", required === "owner" ? "Only the workspace owner can do this." : "Admin access is required.");
  }
  return context;
}

/** A specific workspace by id, regardless of the active selection; non-members get 404. */
export async function requireMembershipOf(workspaceId: string, required: WorkspaceRole = "member"): Promise<WorkspaceContext> {
  const context = await requireUser();
  const workspace = /^[a-z0-9-]{3,64}$/.test(workspaceId) ? await getWorkspaceForUser(workspaceId, context.claims.userId) : null;
  if (!workspace) throw new HttpError(404, "NOT_FOUND", "Workspace not found.");
  if (!hasRole(workspace.role, required)) {
    throw new HttpError(403, "FORBIDDEN", required === "owner" ? "Only the workspace owner can do this." : "Admin access is required.");
  }
  return { ...context, workspace, role: workspace.role };
}
