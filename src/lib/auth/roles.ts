import type { WorkspaceRole } from "@/types/contracts";

/** Higher rank includes every capability of lower ranks. */
const RANK: Record<WorkspaceRole, number> = { member: 1, admin: 2, owner: 3 };

export function hasRole(role: WorkspaceRole | null | undefined, required: WorkspaceRole): boolean {
  return !!role && RANK[role] >= RANK[required];
}

/** Owners and admins manage widgets, tasks, and invitations. */
export function canManage(role: WorkspaceRole | null | undefined): boolean {
  return hasRole(role, "admin");
}

export function isOwner(role: WorkspaceRole | null | undefined): boolean {
  return role === "owner";
}

export const ROLE_LABEL: Record<WorkspaceRole, string> = { owner: "Owner", admin: "Admin", member: "Member" };
