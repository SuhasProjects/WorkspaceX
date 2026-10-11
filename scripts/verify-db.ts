import assert from "node:assert/strict";
import { randomUUID, scryptSync } from "node:crypto";
import { loadEnvConfig } from "@next/env";

let verificationStage = "load environment";
async function main() {
  loadEnvConfig(process.cwd());
  verificationStage = "import database modules";
  const { getDatabase, closeDatabase, DatabaseError } = await import("../src/lib/db/client");
  const { createTask, listTasks, updateTask, deleteTask, createWidget, getWidget, listWidgets, deleteWidget } = await import("../src/lib/db/repository");
  const { createUser, createWorkspace, getWorkspaceForUser } = await import("../src/lib/db/accounts");
  const workspaceId = `verify-${randomUUID()}`;
  const otherWorkspaceId = `verify-${randomUUID()}`;
  let created = false;
  let cleanupCompleted = false;
  try {
    verificationStage = "database connection";
    const db = await getDatabase();
    await db.command({ ping: 1 });
    console.log("PASS: MongoDB connected; indexes initialized.");
    // Unique test-only hashes, never accepted by the future auth password verifier.
    const fixtureHash = () => `test-only:${scryptSync(randomUUID(), randomUUID(), 32).toString("hex")}`;
    const owner = await createUser({ username: `verify-${randomUUID().slice(0, 8)}`, usernameNormalized: `verify-${randomUUID().slice(0, 8)}`, passwordHash: fixtureHash() });
    await createWorkspace({ id: workspaceId, name: "Persistence verification", ownerUserId: owner._id });
    created = true;
    assert.equal((await getWorkspaceForUser(workspaceId, owner._id))?.name, "Persistence verification");
    await assert.rejects(() => createWorkspace({ id: workspaceId, name: "Duplicate", ownerUserId: owner._id }), (error: unknown) => error instanceof DatabaseError && error.code === "CONFLICT");
    const task = await createTask(workspaceId, { title: "Verify task persistence", description: "Stored in MongoDB" });
    assert.deepEqual(await listTasks(workspaceId), [task]);
    const updatedTask = await updateTask(workspaceId, task.id, { status: "done" });
    assert.equal(updatedTask?.status, "done");
    assert.equal(await deleteTask(otherWorkspaceId, task.id), false);
    assert.equal(await deleteTask(workspaceId, task.id), true);
    assert.deepEqual(await listTasks(workspaceId), []);
    console.log("PASS: task creation, updates, deletion, and workspace isolation.");
    const widget = await createWidget(workspaceId, { title: "Verification", html: "<!DOCTYPE html><html><body>Verification</body></html>" });
    assert.deepEqual(await getWidget(workspaceId, widget.id), widget);
    assert.deepEqual(await listWidgets(workspaceId), [widget]);
    assert.equal(await getWidget(otherWorkspaceId, widget.id), null);
    assert.deepEqual(await listWidgets(otherWorkspaceId), []);
    assert.equal(await deleteWidget(otherWorkspaceId, widget.id), false);
    assert.notEqual(await getWidget(workspaceId, widget.id), null);
    console.log("PASS: workspace/widget persistence, duplicate protection, and workspace-scoped queries.");
    // Reuse only the exact test workspace and widget IDs; no database drop.
    await db.collection("widgetData").insertOne({ workspaceId, widgetId: widget.id, key: "fixture", value: 1, updatedAt: new Date() });
    assert.equal(await deleteWidget(workspaceId, widget.id), true);
    assert.equal(await getWidget(workspaceId, widget.id), null);
    assert.equal(await db.collection("widgetData").countDocuments({ workspaceId, widgetId: widget.id }), 0);
    console.log("PASS: widget deletion removes its shared data.");
  } finally {
    try {
      if (created) {
        verificationStage = "database connection";
    const db = await getDatabase();
        await db.collection("tasks").deleteMany({ workspaceId });
        await db.collection("widgets").deleteMany({ workspaceId });
        await db.collection("widgetData").deleteMany({ workspaceId });
        await db.collection("workspaces").deleteOne({ _id: workspaceId } as never);
        cleanupCompleted = true;
      }
    } finally {
      await closeDatabase();
    }
    if (cleanupCompleted) console.log("PASS: verification records removed.");
  }
}

main().catch((error: unknown) => {
  // Never print raw driver errors: those may contain connection details.
  console.error("Database verification failed. Check server configuration, credentials, Atlas network access, and database permissions.");
  if (error instanceof Error && error.name === "DatabaseError" && "code" in error) console.error("Failure category:", error.code);
  console.error("Verification stage:", verificationStage);
  if (error instanceof TypeError) console.error("Failure type: TypeError");
  process.exitCode = 1;
});
