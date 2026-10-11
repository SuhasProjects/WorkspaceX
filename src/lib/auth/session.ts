import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import type { Role } from "@/types/contracts";
import { HttpError } from "./http";

const COOKIE_NAME = "wz_session";
const SESSION_SECONDS = 60 * 60 * 24 * 7;
export interface Session { workspaceId: string; role: Role }

function signingKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new HttpError(503, "SERVICE_UNAVAILABLE", "Session configuration is incomplete.");
  return new TextEncoder().encode(secret);
}

export async function setSession(session: Session): Promise<void> {
  const token = await new SignJWT({ workspaceId: session.workspaceId, role: session.role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_SECONDS}s`)
    .sign(signingKey());
  (await cookies()).set(COOKIE_NAME, token, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax",
    path: "/", maxAge: SESSION_SECONDS,
  });
}

export async function clearSession(): Promise<void> {
  (await cookies()).set(COOKIE_NAME, "", {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax",
    path: "/", maxAge: 0,
  });
}

export async function requireSession(requiredRole?: Role): Promise<Session> {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) throw new HttpError(401, "UNAUTHENTICATED", "Log in to access this workspace.");
  let payload: Record<string, unknown>;
  try {
    const verified = await jwtVerify(token, signingKey(), { algorithms: ["HS256"] });
    payload = verified.payload as Record<string, unknown>;
  } catch { throw new HttpError(401, "UNAUTHENTICATED", "Session expired or invalid."); }
  const workspaceId = payload.workspaceId;
  const role = payload.role;
  if (typeof workspaceId !== "string" || !/^[a-z0-9-]{3,64}$/.test(workspaceId) ||
      (role !== "admin" && role !== "member")) {
    throw new HttpError(401, "UNAUTHENTICATED", "Session expired or invalid.");
  }
  if (requiredRole && role !== requiredRole) {
    throw new HttpError(403, "FORBIDDEN", "Admin access is required.");
  }
  return { workspaceId, role };
}