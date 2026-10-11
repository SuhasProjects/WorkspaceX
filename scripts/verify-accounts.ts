/**
 * API-level verification of accounts, memberships, invitations, and plan limits.
 * Run against a dev server pointed at a throwaway database:
 *   BASE_URL=http://localhost:3000 MONGODB_URI=... MONGODB_DB=... npm run verify:accounts
 * Plan upgrades are simulated by writing users.subscription directly (what a
 * verified billing webhook would do); no checkout is performed.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { MongoClient } from "mongodb";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const ORIGIN = new URL(BASE).origin;
type Json = Record<string, unknown>;

class Client {
  cookie = "";
  constructor(public label: string) {}
  async call(method: string, path: string, body?: unknown): Promise<{ status: number; data?: Json; error?: { code: string; message: string } }> {
    const response = await fetch(BASE + path, {
      method,
      headers: { "Content-Type": "application/json", Origin: ORIGIN, "Sec-Fetch-Site": "same-origin", ...(this.cookie ? { Cookie: this.cookie } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const setCookie = response.headers.get("set-cookie");
    if (setCookie) this.cookie = setCookie.split(";")[0];
    const json = (await response.json().catch(() => ({}))) as { data?: Json; error?: { code: string; message: string } };
    return { status: response.status, ...json };
  }
}

const suffix = randomUUID().slice(0, 6);
const PASSWORD = "correct-horse-battery-staple";
let passed = 0;
function ok(name: string, condition: boolean, detail?: unknown) {
  if (!condition) { console.error(`FAIL: ${name}`, detail ?? ""); process.exitCode = 1; }
  else { passed++; console.log(`PASS: ${name}`); }
}

async function main() {
  const mongo = new MongoClient(process.env.MONGODB_URI!);
  const db = mongo.db(process.env.MONGODB_DB!);
  const setPlan = (userId: string, plan: "pro" | "team") => db.collection("users").updateOne({ _id: userId as never }, { $set: { subscription: { plan, status: "active", updatedAt: new Date() } } });

  const owner = new Client("owner"), mate = new Client("mate"), stranger = new Client("stranger");
  const ownerName = `Owner_${suffix}`, mateName = `mate_${suffix}`, strangerName = `str_${suffix}`;

  // 1. registration + case-insensitive uniqueness
  let r = await owner.call("POST", "/api/auth/register", { username: ownerName, password: PASSWORD, workspaceName: "Owner HQ" });
  ok("register owner (201)", r.status === 201 && !!r.data?.workspace, r);
  const ownerId = (r.data!.account as Json).id as string; const hq = (r.data!.workspace as Json).id as string;
  r = await stranger.call("POST", "/api/auth/register", { username: ownerName.toLowerCase(), password: PASSWORD, workspaceName: "dup" });
  ok("1. username uniqueness is case-insensitive (409)", r.status === 409, r);
  r = await stranger.call("POST", "/api/auth/register", { username: "admin", password: PASSWORD, workspaceName: "x" });
  ok("reserved username rejected (400)", r.status === 400, r);
  r = await mate.call("POST", "/api/auth/register", { username: mateName, password: PASSWORD, workspaceName: "Mate space" });
  ok("register mate (201)", r.status === 201, r); const mateId = (r.data!.account as Json).id as string;
  r = await stranger.call("POST", "/api/auth/register", { username: strangerName, password: PASSWORD, workspaceName: "Stranger space" });
  ok("register stranger (201)", r.status === 201, r);

  // 2. login does not reveal usernames
  const anon = new Client("anon");
  const a = await anon.call("POST", "/api/auth/login", { username: ownerName, password: "wrong-password-123" });
  const b = await anon.call("POST", "/api/auth/login", { username: `nobody_${suffix}`, password: "wrong-password-123" });
  ok("2. invalid login never reveals username existence", a.status === 401 && b.status === 401 && a.error?.message === b.error?.message, [a, b]);
  r = await anon.call("POST", "/api/auth/login", { username: ownerName.toUpperCase(), password: PASSWORD });
  ok("login is case-insensitive and restores a workspace", r.status === 200 && (r.data?.workspace as Json)?.id === hq, r);

  // 3-5. ownership limits
  r = await owner.call("POST", "/api/workspaces", { name: "Second" });
  ok("3. free user blocked at second owned workspace (PLAN_LIMIT_REACHED)", r.status === 403 && r.error?.code === "PLAN_LIMIT_REACHED", r);
  await setPlan(ownerId, "pro");
  r = await owner.call("POST", "/api/workspaces", { name: "Second" }); const second = (r.data?.workspace as Json)?.id as string;
  r = await owner.call("POST", "/api/workspaces", { name: "Third" });
  ok("4a. pro user can own three", r.status === 201, r);
  r = await owner.call("POST", "/api/workspaces", { name: "Fourth" });
  ok("4b. pro user blocked at fourth", r.status === 403, r);
  await setPlan(ownerId, "team");
  r = await owner.call("POST", "/api/workspaces", { name: "Fourth" });
  ok("4c. team user owns more than three", r.status === 201, r);
  await owner.call("POST", `/api/workspaces/${hq}/select`);

  // 6. non-team cannot invite
  r = await mate.call("POST", `/api/workspaces/${(await mate.call("GET", "/api/workspaces/current")).data!.workspace && ((await mate.call("GET", "/api/workspaces/current")).data!.workspace as Json).id}/invitations`, { username: strangerName, role: "member" });
  ok("6. free workspace cannot invite (PLAN_FEATURE_REQUIRED)", r.status === 403 && r.error?.code === "PLAN_FEATURE_REQUIRED", r);

  // 7-8. invitations
  r = await owner.call("POST", `/api/workspaces/${hq}/invitations`, { username: mateName, role: "admin" });
  ok("team owner invites mate as admin (201)", r.status === 201, r); const inviteId = (r.data!.invitation as Json).id as string;
  r = await owner.call("POST", `/api/workspaces/${hq}/invitations`, { username: mateName, role: "member" });
  ok("8a. duplicate pending invitation rejected (409)", r.status === 409, r);
  r = await stranger.call("GET", "/api/invitations");
  ok("7a. invitation not visible to another user", r.status === 200 && (r.data!.invitations as unknown[]).length === 0, r);
  r = await stranger.call("POST", `/api/invitations/${inviteId}/accept`);
  ok("7b. another user cannot accept it (404)", r.status === 404, r);
  r = await mate.call("GET", "/api/invitations");
  ok("7c. invitation visible to the invited user", r.status === 200 && (r.data!.invitations as unknown[]).length === 1, r);
  r = await mate.call("POST", `/api/invitations/${inviteId}/accept`);
  ok("mate accepts (200)", r.status === 200 && (r.data?.workspace as Json)?.role === "admin", r);
  r = await mate.call("POST", `/api/invitations/${inviteId}/accept`);
  ok("8b. accepted invitation cannot be reused (409)", r.status === 409, r);
  r = await owner.call("POST", `/api/workspaces/${hq}/invitations`, { username: mateName, role: "member" });
  ok("8c. existing member cannot be invited again (409)", r.status === 409, r);
  // revoked + declined paths
  r = await owner.call("POST", `/api/workspaces/${hq}/invitations`, { username: strangerName, role: "member" }); const inv2 = (r.data!.invitation as Json).id as string;
  await owner.call("DELETE", `/api/workspaces/${hq}/invitations/${inv2}`);
  r = await stranger.call("POST", `/api/invitations/${inv2}/accept`);
  ok("8d. revoked invitation cannot create membership", r.status === 409, r);
  r = await owner.call("POST", `/api/workspaces/${hq}/invitations`, { username: strangerName, role: "member" }); const inv3 = (r.data!.invitation as Json).id as string;
  await stranger.call("POST", `/api/invitations/${inv3}/decline`);
  r = await stranger.call("POST", `/api/invitations/${inv3}/accept`);
  ok("8e. declined invitation cannot be accepted", r.status === 409, r);
  // expired
  r = await owner.call("POST", `/api/workspaces/${hq}/invitations`, { username: strangerName, role: "member" }); const inv4 = (r.data!.invitation as Json).id as string;
  await db.collection("workspaceInvitations").updateOne({ _id: inv4 as never }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
  r = await stranger.call("POST", `/api/invitations/${inv4}/accept`);
  ok("8f. expired invitation cannot be accepted", r.status === 409, r);

  // 5. joined workspaces do not consume allowance (mate is free, owns 1, joined 1, can still not create a 2nd -> but joined doesn't count: owned=1 limit=1)
  r = await mate.call("GET", "/api/billing");
  ok("5. joined workspace does not count as owned", r.status === 200 && r.data?.ownedWorkspaces === 1, r);

  // 16. seat count dedupes
  await owner.call("POST", `/api/workspaces/${second}/select`);
  r = await owner.call("POST", `/api/workspaces/${second}/invitations`, { username: mateName, role: "member" }); const inv5 = (r.data!.invitation as Json).id as string;
  await mate.call("POST", `/api/invitations/${inv5}/accept`);
  r = await owner.call("GET", "/api/billing");
  ok("16. team seat count dedupes the same user across owned workspaces (2)", r.data?.seatCount === 2, r);
  await owner.call("POST", `/api/workspaces/${hq}/select`);

  // 10-12. role matrix
  await mate.call("POST", `/api/workspaces/${hq}/select`);
  r = await mate.call("POST", "/api/tasks", { title: "admin task" }); const taskId = (r.data?.task as Json)?.id as string;
  ok("admin can create tasks", r.status === 201, r);
  r = await mate.call("POST", "/api/widgets", { title: "T", html: "<!DOCTYPE html><html><head><title>T</title></head><body>x</body></html>" });
  ok("admin can create widgets", r.status === 201, r); const widgetId = (r.data?.widget as Json)?.id as string;
  // demote mate to member and recheck
  r = await owner.call("PATCH", `/api/workspaces/${hq}/members/${mateId}`, { role: "member" });
  ok("12a. owner demotes admin to member", r.status === 200, r);
  r = await mate.call("PATCH", `/api/tasks/${taskId}`, { title: "renamed" });
  ok("10a. member cannot edit task content (403)", r.status === 403, r);
  r = await mate.call("PATCH", `/api/tasks/${taskId}`, { status: "done" });
  ok("10b. member can change task status", r.status === 200, r);
  r = await mate.call("POST", "/api/widgets", { title: "T2", html: "<!DOCTYPE html><html><head><title>T</title></head><body>x</body></html>" });
  ok("10c. member cannot create widgets (403)", r.status === 403, r);
  r = await mate.call("PATCH", `/api/workspaces/${hq}/members/${ownerId}`, { role: "member" });
  ok("11a. member cannot change roles", r.status === 403, r);
  r = await owner.call("PATCH", `/api/workspaces/${hq}/members/${mateId}`, { role: "admin" });
  ok("12b. owner promotes member to admin", r.status === 200, r);
  r = await mate.call("DELETE", `/api/workspaces/${hq}/members/${ownerId}`);
  ok("11b. admin cannot remove the owner", r.status === 403, r);
  r = await mate.call("PATCH", `/api/workspaces/${hq}/members/${ownerId}`, { role: "member" });
  ok("11c. admin cannot change owner role", r.status === 403, r);

  // 15. invited admin consumes owner's generation quota
  await db.collection("users").updateOne({ _id: ownerId as never }, { $set: { [`generationUsage.${new Date().toISOString().slice(0, 7)}`]: 100 } });
  r = await mate.call("POST", "/api/generate", { prompt: "a countdown" });
  ok("15. invited admin is charged against the owner's quota (GENERATION_LIMIT_REACHED)", r.status === 403 && r.error?.code === "GENERATION_LIMIT_REACHED", r);

  // 13-14. switching never leaks; cross-workspace ids are 404
  await mate.call("POST", `/api/workspaces/${(await mate.call("GET", "/api/workspaces")).data!.workspaces && ((r = await mate.call("GET", "/api/workspaces")).data!.workspaces as Json[]).find((w) => w.ownerId === mateId)!.id}/select`);
  r = await mate.call("GET", "/api/widgets");
  ok("13. after switching, the other workspace's widgets are not visible", r.status === 200 && !(r.data!.widgets as Json[]).some((w) => w.id === widgetId), r);
  r = await mate.call("GET", `/api/storage?widgetId=${widgetId}&key=x`);
  ok("14. another workspace's widget id returns 404", r.status === 404, r);
  r = await stranger.call("GET", `/api/workspaces/${hq}/members`);
  ok("14b. non-member sees 404 for members list", r.status === 404, r);

  // 9. removal takes effect immediately
  await mate.call("POST", `/api/workspaces/${hq}/select`);
  r = await owner.call("DELETE", `/api/workspaces/${hq}/members/${mateId}`);
  ok("12c. owner removes admin", r.status === 200, r);
  r = await mate.call("GET", "/api/widgets");
  ok("9. removed user loses access on the next request (409 NO_ACTIVE_WORKSPACE)", r.status === 409 && r.error?.code === "NO_ACTIVE_WORKSPACE", r);
  r = await mate.call("GET", `/api/workspaces/${hq}/members`);
  ok("9b. removed user cannot read the workspace directly (404)", r.status === 404, r);

  // 17. logout + bad cookies
  r = await mate.call("POST", "/api/auth/logout");
  r = await mate.call("GET", "/api/account");
  ok("17a. logout clears the session (401)", r.status === 401, r);
  const forged = new Client("forged"); forged.cookie = "wz_session=not-a-real-token";
  r = await forged.call("GET", "/api/account");
  ok("17b. malformed cookie is 401", r.status === 401, r);

  // 18. storage scoped to active workspace + widget (owner, HQ)
  r = await owner.call("PUT", "/api/storage", { widgetId, key: "k", value: { v: 1 } });
  ok("18a. storage write in own workspace", r.status === 200, r);
  await owner.call("POST", `/api/workspaces/${second}/select`);
  r = await owner.call("GET", `/api/storage?widgetId=${widgetId}&key=k`);
  ok("18b. same widget id is not reachable from another active workspace (404)", r.status === 404, r);

  await mongo.close();
  console.log(`\n${passed} checks passed${process.exitCode ? ", with failures" : ""}.`);
}

main().catch((error) => { console.error(error); process.exit(1); });
