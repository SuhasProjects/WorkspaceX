/**
 * Destructive, operator-run reset of WorkspaceZero's application collections.
 *
 *   RESET_CONFIRM=yes npm run db:reset
 *
 * Refuses production-looking targets unless RESET_PRODUCTION_CONFIRM=yes is
 * also set. Never run from startup, build, tests, or deployment.
 */
import { loadEnvConfig } from "@next/env";

const COLLECTIONS = ["users", "workspaces", "workspaceMemberships", "workspaceInvitations", "widgets", "widgetData", "tasks", "billingEvents"];

async function main() {
  loadEnvConfig(process.cwd());
  if (process.env.RESET_CONFIRM !== "yes") {
    console.error("Refusing: set RESET_CONFIRM=yes to clear the WorkspaceZero collections.");
    process.exit(2);
  }
  const uri = process.env.MONGODB_URI ?? "";
  const dbName = process.env.MONGODB_DB ?? "";
  const host = (() => { try { return new URL(uri.replace(/^mongodb\+srv/, "https")).host; } catch { return "(unparseable host)"; } })();
  const productionLike = /prod|live|main/i.test(dbName) || process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
  if (productionLike && process.env.RESET_PRODUCTION_CONFIRM !== "yes") {
    console.error(`Refusing: database "${dbName}" on ${host} looks like production. Set RESET_PRODUCTION_CONFIRM=yes as well if you really mean it.`);
    process.exit(3);
  }
  const { getDatabase, closeDatabase } = await import("../src/lib/db/client");
  const db = await getDatabase();
  const existing = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name));
  console.log(`Database: ${dbName} on ${host}`);
  console.log(`Clearing: ${COLLECTIONS.filter((c) => existing.has(c)).join(", ") || "(nothing present)"}`);
  for (const name of COLLECTIONS) {
    if (existing.has(name)) await db.collection(name).drop();
  }
  // Recreate indexes through the normal initialization path.
  await closeDatabase();
  await getDatabase();
  console.log("Reset complete; indexes recreated.");
  await closeDatabase();
}

main().catch((error) => { console.error("Reset failed:", error instanceof Error ? error.message : error); process.exit(1); });
