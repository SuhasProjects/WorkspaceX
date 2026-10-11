/**
 * Creates two demo accounts for recordings, with paid plans set directly
 * (what a verified billing webhook would do). Operator-run only:
 *   SEED_DEMO=yes npm run seed:demo
 * Idempotent: existing demo users keep their password; plans are re-applied.
 */
import { hash } from "bcryptjs";
import { loadEnvConfig } from "@next/env";

const DEMO_PASSWORD = "WorkspaceZero-Demo-2026";
const DEMOS = [
  { username: "demo-team", plan: "team" as const, workspace: "Northwind Launch Team" },
  { username: "demo-pro", plan: "pro" as const, workspace: "Solo Studio" },
  { username: "demo-member", plan: "free" as const, workspace: "Member Sandbox" },
];

async function main() {
  loadEnvConfig(process.cwd());
  if (process.env.SEED_DEMO !== "yes") { console.error("Refusing: set SEED_DEMO=yes to create demo accounts."); process.exit(2); }
  const { closeDatabase } = await import("../src/lib/db/client");
  const { createUser, createWorkspace, getUserByUsername, listWorkspacesForUser, setUserSubscription } = await import("../src/lib/db/accounts");
  const { BCRYPT_COST } = await import("../src/lib/auth/usernames");
  const passwordHash = await hash(DEMO_PASSWORD, BCRYPT_COST);
  for (const demo of DEMOS) {
    let user = await getUserByUsername(demo.username);
    if (!user) user = await createUser({ username: demo.username, usernameNormalized: demo.username, passwordHash });
    if (demo.plan !== "free") await setUserSubscription(user._id, { plan: demo.plan, status: "active", externalId: `demo-${demo.plan}` });
    if (!(await listWorkspacesForUser(user._id)).length) {
      await createWorkspace({ id: `${demo.username}-${Math.random().toString(36).slice(2, 8)}`, name: demo.workspace, ownerUserId: user._id });
    }
    console.log(`ready: ${demo.username} (${demo.plan})`);
  }
  console.log(`password for all demo accounts: ${DEMO_PASSWORD}`);
  await closeDatabase();
}
main().catch((error) => { console.error("Seed failed:", error instanceof Error ? error.message : error); process.exit(1); });
