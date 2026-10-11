import "server-only";
import { randomUUID } from "node:crypto";
import { MongoServerError } from "mongodb";
import { DatabaseError, getDatabase } from "./client";
import { effectivePlan, usageMonth } from "@/lib/billing/plans";
import { demoPlanFor } from "@/lib/billing/demo-plans";
import type {
  Account, InvitationRole, InvitationStatus, Membership, Plan, Subscription, SubscriptionStatus,
  WorkspaceInvitation, WorkspaceRole, WorkspaceSummary,
} from "@/types/contracts";

// ---------------------------------------------------------------------------
// Records
// ---------------------------------------------------------------------------

export interface UserRecord {
  _id: string;
  username: string;
  usernameNormalized: string;
  passwordHash: string;
  subscription?: { plan: Plan; status: SubscriptionStatus; externalId?: string; updatedAt: Date };
  /** AI generations per calendar month across every workspace this user owns. */
  generationUsage?: Record<string, number>;
  /** Most recently selected workspace, used to pick the default after login. */
  lastWorkspaceId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkspaceRecord {
  _id: string;
  name: string;
  ownerUserId: string;
  widgetOrder?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface MembershipRecord {
  _id: string;
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  createdAt: Date;
  updatedAt: Date;
}

export interface InvitationRecord {
  _id: string;
  workspaceId: string;
  invitedUserId: string;
  invitedByUserId: string;
  role: InvitationRole;
  status: InvitationStatus;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
}

export const INVITATION_DAYS = 7;

// ---------------------------------------------------------------------------
// Validation helpers (shared with repository.ts)
// ---------------------------------------------------------------------------

export function checkWorkspaceId(id: string): void {
  if (typeof id !== "string" || !/^[a-z0-9-]{3,64}$/.test(id)) {
    throw new DatabaseError("INVALID_INPUT", "Workspace ID must be 3 to 64 lowercase letters, digits, or hyphens.");
  }
}

export function checkedTitle(title: string): string {
  const trimmed = typeof title === "string" ? title.trim() : "";
  if (!trimmed || trimmed.length > 120) throw new DatabaseError("INVALID_INPUT", "Titles must be 1 to 120 characters.");
  return trimmed;
}

function checkUuid(id: string, what: string): void {
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/.test(id)) throw new DatabaseError("INVALID_INPUT", `Invalid ${what}.`);
}

const FREE_SUBSCRIPTION = (): Subscription => ({ plan: "free", status: "none", updatedAt: new Date(0).toISOString() });

function publicSubscription(record: Pick<UserRecord, "subscription">): Subscription {
  const sub = record.subscription;
  if (!sub) return FREE_SUBSCRIPTION();
  return { plan: sub.plan, status: sub.status, ...(sub.externalId ? { externalId: sub.externalId } : {}), updatedAt: sub.updatedAt.toISOString() };
}

export function publicAccount(record: UserRecord): Account {
  const subscription = publicSubscription(record);
  return { id: record._id, username: record.username, plan: demoPlanFor(record.usernameNormalized) ?? effectivePlan(subscription), subscription };
}

export function userPlan(record: Pick<UserRecord, "subscription" | "usernameNormalized"> | null | undefined): Plan {
  if (!record) return "free";
  return demoPlanFor(record.usernameNormalized) ?? effectivePlan(publicSubscription(record));
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export async function createUser(input: { username: string; usernameNormalized: string; passwordHash: string }): Promise<UserRecord> {
  const db = await getDatabase();
  const now = new Date();
  const record: UserRecord = { _id: randomUUID(), username: input.username, usernameNormalized: input.usernameNormalized, passwordHash: input.passwordHash, createdAt: now, updatedAt: now };
  try {
    await db.collection<UserRecord>("users").insertOne(record);
  } catch (error) {
    if (error instanceof MongoServerError && error.code === 11000) throw new DatabaseError("CONFLICT", "That username is taken.");
    throw error;
  }
  return record;
}

export async function getUserById(userId: string): Promise<UserRecord | null> {
  if (typeof userId !== "string" || !userId) return null;
  const db = await getDatabase();
  return db.collection<UserRecord>("users").findOne({ _id: userId });
}

export async function getUserByUsername(usernameNormalized: string): Promise<UserRecord | null> {
  const db = await getDatabase();
  return db.collection<UserRecord>("users").findOne({ usernameNormalized });
}

export async function setLastWorkspace(userId: string, workspaceId: string): Promise<void> {
  const db = await getDatabase();
  await db.collection<UserRecord>("users").updateOne({ _id: userId }, { $set: { lastWorkspaceId: workspaceId, updatedAt: new Date() } });
}

/** Only the billing webhook path (verified) or checkout (pending) may call this. */
export async function setUserSubscription(userId: string, input: { plan: Plan; status: SubscriptionStatus; externalId?: string }): Promise<Account | null> {
  const db = await getDatabase();
  const record = await db.collection<UserRecord>("users").findOneAndUpdate(
    { _id: userId },
    { $set: { subscription: { plan: input.plan, status: input.status, ...(input.externalId ? { externalId: input.externalId } : {}), updatedAt: new Date() }, updatedAt: new Date() } },
    { returnDocument: "after" },
  );
  return record ? publicAccount(record) : null;
}

export async function getGenerationCount(userId: string, month = usageMonth()): Promise<number> {
  const db = await getDatabase();
  const record = await db.collection<UserRecord>("users").findOne({ _id: userId }, { projection: { generationUsage: 1 } });
  return record?.generationUsage?.[month] ?? 0;
}

export async function recordGeneration(userId: string, month = usageMonth()): Promise<void> {
  const db = await getDatabase();
  await db.collection<UserRecord>("users").updateOne({ _id: userId }, { $inc: { [`generationUsage.${month}`]: 1 } });
}

// ---------------------------------------------------------------------------
// Workspaces and memberships
// ---------------------------------------------------------------------------

async function summarize(record: WorkspaceRecord, role: WorkspaceRole, owner?: UserRecord | null): Promise<WorkspaceSummary> {
  const ownerRecord = owner === undefined ? await getUserById(record.ownerUserId) : owner;
  return { id: record._id, name: record.name, role, ownerId: record.ownerUserId, plan: userPlan(ownerRecord) };
}

export async function countOwnedWorkspaces(userId: string): Promise<number> {
  const db = await getDatabase();
  return db.collection<WorkspaceRecord>("workspaces").countDocuments({ ownerUserId: userId });
}

/** Inserts the workspace and its owner membership; rolls the workspace back if the membership fails. */
export async function createWorkspace(input: { id: string; name: string; ownerUserId: string }): Promise<WorkspaceSummary> {
  checkWorkspaceId(input.id);
  const name = checkedTitle(input.name);
  const db = await getDatabase();
  const now = new Date();
  const workspace: WorkspaceRecord = { _id: input.id, name, ownerUserId: input.ownerUserId, createdAt: now, updatedAt: now };
  try {
    await db.collection<WorkspaceRecord>("workspaces").insertOne(workspace);
  } catch (error) {
    if (error instanceof MongoServerError && error.code === 11000) throw new DatabaseError("CONFLICT", "Workspace ID already exists.");
    throw error;
  }
  try {
    await db.collection<MembershipRecord>("workspaceMemberships").insertOne({ _id: randomUUID(), workspaceId: input.id, userId: input.ownerUserId, role: "owner", createdAt: now, updatedAt: now });
  } catch (error) {
    await db.collection<WorkspaceRecord>("workspaces").deleteOne({ _id: input.id });
    throw error;
  }
  const owner = await getUserById(input.ownerUserId);
  return summarize(workspace, "owner", owner);
}

export async function getMembership(workspaceId: string, userId: string): Promise<MembershipRecord | null> {
  checkWorkspaceId(workspaceId);
  const db = await getDatabase();
  return db.collection<MembershipRecord>("workspaceMemberships").findOne({ workspaceId, userId });
}

/** The workspace as seen by this user, or null when the user is not a member (404-equivalent). */
export async function getWorkspaceForUser(workspaceId: string, userId: string): Promise<WorkspaceSummary | null> {
  checkWorkspaceId(workspaceId);
  const db = await getDatabase();
  const membership = await getMembership(workspaceId, userId);
  if (!membership) return null;
  const record = await db.collection<WorkspaceRecord>("workspaces").findOne({ _id: workspaceId });
  return record ? summarize(record, membership.role) : null;
}

export async function getWorkspaceRecord(workspaceId: string): Promise<WorkspaceRecord | null> {
  checkWorkspaceId(workspaceId);
  const db = await getDatabase();
  return db.collection<WorkspaceRecord>("workspaces").findOne({ _id: workspaceId });
}

/** Effective plan of a workspace: its owner's active plan. */
export async function getWorkspacePlan(workspaceId: string): Promise<{ plan: Plan; ownerUserId: string }> {
  const record = await getWorkspaceRecord(workspaceId);
  if (!record) throw new DatabaseError("NOT_FOUND", "Workspace not found.");
  return { plan: userPlan(await getUserById(record.ownerUserId)), ownerUserId: record.ownerUserId };
}

export async function listWorkspacesForUser(userId: string): Promise<WorkspaceSummary[]> {
  const db = await getDatabase();
  const memberships = await db.collection<MembershipRecord>("workspaceMemberships").find({ userId }).sort({ createdAt: 1 }).toArray();
  if (!memberships.length) return [];
  const records = await db.collection<WorkspaceRecord>("workspaces").find({ _id: { $in: memberships.map((m) => m.workspaceId) } }).toArray();
  const ownerIds = Array.from(new Set(records.map((r) => r.ownerUserId)));
  const owners = await db.collection<UserRecord>("users").find({ _id: { $in: ownerIds } }, { projection: { subscription: 1, usernameNormalized: 1 } }).toArray();
  const ownerById = new Map(owners.map((o) => [o._id, o]));
  const byId = new Map(records.map((r) => [r._id, r]));
  const result: WorkspaceSummary[] = [];
  for (const membership of memberships) {
    const record = byId.get(membership.workspaceId);
    if (!record) continue;
    result.push({ id: record._id, name: record.name, role: membership.role, ownerId: record.ownerUserId, plan: userPlan(ownerById.get(record.ownerUserId) as UserRecord | undefined) });
  }
  return result;
}

export async function listMembers(workspaceId: string): Promise<Membership[]> {
  checkWorkspaceId(workspaceId);
  const db = await getDatabase();
  const memberships = await db.collection<MembershipRecord>("workspaceMemberships").find({ workspaceId }).sort({ createdAt: 1 }).toArray();
  const users = await db.collection<UserRecord>("users").find({ _id: { $in: memberships.map((m) => m.userId) } }, { projection: { username: 1 } }).toArray();
  const nameById = new Map(users.map((u) => [u._id, u.username]));
  const order: Record<WorkspaceRole, number> = { owner: 0, admin: 1, member: 2 };
  return memberships
    .map((m) => ({ userId: m.userId, username: nameById.get(m.userId) ?? "unknown", role: m.role, joinedAt: m.createdAt.toISOString() }))
    .sort((a, b) => order[a.role] - order[b.role] || a.joinedAt.localeCompare(b.joinedAt));
}

export async function updateMemberRole(workspaceId: string, userId: string, role: InvitationRole): Promise<boolean> {
  checkWorkspaceId(workspaceId);
  const db = await getDatabase();
  const result = await db.collection<MembershipRecord>("workspaceMemberships").updateOne(
    { workspaceId, userId, role: { $ne: "owner" } }, { $set: { role, updatedAt: new Date() } },
  );
  return result.matchedCount > 0;
}

/** Removes a non-owner membership. The sole owner can never be removed. */
export async function removeMember(workspaceId: string, userId: string): Promise<boolean> {
  checkWorkspaceId(workspaceId);
  const db = await getDatabase();
  const result = await db.collection<MembershipRecord>("workspaceMemberships").deleteOne({ workspaceId, userId, role: { $ne: "owner" } });
  if (result.deletedCount > 0) {
    await db.collection<UserRecord>("users").updateOne({ _id: userId, lastWorkspaceId: workspaceId }, { $unset: { lastWorkspaceId: true } });
  }
  return result.deletedCount > 0;
}

/** Unique accepted users across every workspace the subscriber owns (the owner counts once). */
export async function countTeamSeats(ownerUserId: string): Promise<number> {
  const db = await getDatabase();
  const owned = await db.collection<WorkspaceRecord>("workspaces").find({ ownerUserId }, { projection: { _id: 1 } }).toArray();
  if (!owned.length) return 1;
  const userIds = await db.collection<MembershipRecord>("workspaceMemberships").distinct("userId", { workspaceId: { $in: owned.map((w) => w._id) } });
  return new Set([...userIds, ownerUserId]).size;
}

// ---------------------------------------------------------------------------
// Invitations
// ---------------------------------------------------------------------------

async function publicInvitation(record: InvitationRecord): Promise<WorkspaceInvitation> {
  const db = await getDatabase();
  const [workspace, inviter, invitee] = await Promise.all([
    db.collection<WorkspaceRecord>("workspaces").findOne({ _id: record.workspaceId }, { projection: { name: 1 } }),
    getUserById(record.invitedByUserId),
    getUserById(record.invitedUserId),
  ]);
  return {
    id: record._id,
    workspace: { id: record.workspaceId, name: workspace?.name ?? "Deleted workspace" },
    invitedBy: { id: record.invitedByUserId, username: inviter?.username ?? "unknown" },
    invitedUsername: invitee?.username,
    role: record.role,
    status: record.status,
    expiresAt: record.expiresAt.toISOString(),
  };
}

export async function createInvitation(input: { workspaceId: string; invitedUserId: string; invitedByUserId: string; role: InvitationRole }): Promise<WorkspaceInvitation> {
  checkWorkspaceId(input.workspaceId);
  const db = await getDatabase();
  if (await getMembership(input.workspaceId, input.invitedUserId)) throw new DatabaseError("CONFLICT", "That user is already a member of this workspace.");
  const now = new Date();
  // Earlier expired, declined, or revoked invites are superseded by the new one.
  await db.collection<InvitationRecord>("workspaceInvitations").updateMany(
    { workspaceId: input.workspaceId, invitedUserId: input.invitedUserId, status: "pending", expiresAt: { $lte: now } },
    { $set: { status: "revoked", updatedAt: now } },
  );
  const record: InvitationRecord = {
    _id: randomUUID(), workspaceId: input.workspaceId, invitedUserId: input.invitedUserId, invitedByUserId: input.invitedByUserId,
    role: input.role, status: "pending", createdAt: now, updatedAt: now, expiresAt: new Date(now.getTime() + INVITATION_DAYS * 86_400_000),
  };
  try {
    await db.collection<InvitationRecord>("workspaceInvitations").insertOne(record);
  } catch (error) {
    if (error instanceof MongoServerError && error.code === 11000) throw new DatabaseError("CONFLICT", "That user already has a pending invitation.");
    throw error;
  }
  return publicInvitation(record);
}

export async function listPendingInvitationsForUser(userId: string): Promise<WorkspaceInvitation[]> {
  const db = await getDatabase();
  const records = await db.collection<InvitationRecord>("workspaceInvitations")
    .find({ invitedUserId: userId, status: "pending", expiresAt: { $gt: new Date() } }).sort({ createdAt: -1 }).toArray();
  return Promise.all(records.map(publicInvitation));
}

export async function listPendingInvitationsForWorkspace(workspaceId: string): Promise<WorkspaceInvitation[]> {
  checkWorkspaceId(workspaceId);
  const db = await getDatabase();
  const records = await db.collection<InvitationRecord>("workspaceInvitations")
    .find({ workspaceId, status: "pending", expiresAt: { $gt: new Date() } }).sort({ createdAt: -1 }).toArray();
  return Promise.all(records.map(publicInvitation));
}

export async function getInvitation(invitationId: string): Promise<InvitationRecord | null> {
  checkUuid(invitationId, "invitation id");
  const db = await getDatabase();
  return db.collection<InvitationRecord>("workspaceInvitations").findOne({ _id: invitationId });
}

/** Marks the invitation accepted and creates the membership; only a live pending invite transitions. */
export async function acceptInvitation(record: InvitationRecord): Promise<WorkspaceSummary> {
  const db = await getDatabase();
  const now = new Date();
  const claimed = await db.collection<InvitationRecord>("workspaceInvitations").findOneAndUpdate(
    { _id: record._id, status: "pending", expiresAt: { $gt: now } },
    { $set: { status: "accepted", updatedAt: now } },
  );
  if (!claimed) throw new DatabaseError("CONFLICT", "This invitation is no longer valid.");
  try {
    await db.collection<MembershipRecord>("workspaceMemberships").insertOne({ _id: randomUUID(), workspaceId: record.workspaceId, userId: record.invitedUserId, role: record.role, createdAt: now, updatedAt: now });
  } catch (error) {
    if (!(error instanceof MongoServerError && error.code === 11000)) {
      await db.collection<InvitationRecord>("workspaceInvitations").updateOne({ _id: record._id }, { $set: { status: "pending", updatedAt: now } });
      throw error;
    }
  }
  const workspace = await getWorkspaceForUser(record.workspaceId, record.invitedUserId);
  if (!workspace) throw new DatabaseError("NOT_FOUND", "Workspace not found.");
  return workspace;
}

export async function setInvitationStatus(invitationId: string, status: Exclude<InvitationStatus, "accepted" | "pending">): Promise<boolean> {
  const db = await getDatabase();
  const result = await db.collection<InvitationRecord>("workspaceInvitations").updateOne(
    { _id: invitationId, status: "pending" }, { $set: { status, updatedAt: new Date() } },
  );
  return result.matchedCount > 0;
}
