import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());
const base = "http://127.0.0.1:3002";
const workspaceId = `verify-${randomUUID()}`;
const secondId = `verify-${randomUUID()}`;
let savedWidgetId = "";
let stage = "create";

interface VerificationResponse {
  error: { code?: string };
  data: {
    workspace: { role: string };
    widget: { id: string };
    value: unknown;
    widgets: unknown[];
  };
}

async function call(path: string, method = "GET", body?: unknown, cookie?: string) {
  const response = await fetch(base + path, {
    method,
    headers: { ...(body ? { "Content-Type": "application/json" } : {}),
      ...(method !== "GET" ? { Origin: base } : {}), ...(cookie ? { Cookie: cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  return { status: response.status, json: await response.json() as VerificationResponse,
    cookie: response.headers.get("set-cookie")?.split(";")[0] ?? "" };
}

async function main() {
  const { getDatabase, closeDatabase } = await import("../src/lib/db/client");
  try {
    const created = await call("/api/workspaces", "POST", {
      name: "Verification", workspaceId, adminPassword: "AdminTestPass123!", memberPassword: "MemberTestPass123!",
    });
    if (created.status !== 201) console.error("Create failed:", created.status, created.json.error?.code);
    assert.equal(created.status, 201);
    stage = "admin session";
    const adminCookie = created.cookie;
    assert.ok(adminCookie.startsWith("wz_session="));
    assert.equal((await call("/api/workspaces/current", "GET", undefined, adminCookie)).json.data.workspace.role, "admin");
    stage = "widget create";
    const widget = await call("/api/widgets", "POST", {
      title: "Test", html: "<!DOCTYPE html><html><head><title>Test</title></head><body>Test</body></html>",
    }, adminCookie);
    assert.equal(widget.status, 201);
    stage = "storage";
    savedWidgetId = widget.json.data.widget.id;
    assert.equal((await call("/api/storage", "PUT", { widgetId: savedWidgetId, key: "votes", value: 2 }, adminCookie)).status, 200);
    const query = `/api/storage?widgetId=${savedWidgetId}&key=votes`;
    assert.deepEqual((await call(query, "GET", undefined, adminCookie)).json.data, { value: 2, exists: true });
    assert.equal((await call(query)).status, 401);
    stage = "member";
    const memberLogin = await call("/api/auth/login", "POST", { workspaceId, password: "MemberTestPass123!" });
    assert.equal(memberLogin.status, 200);
    assert.equal(memberLogin.json.data.workspace.role, "member");
    assert.equal((await call(query, "GET", undefined, memberLogin.cookie)).json.data.value, 2);
    assert.equal((await call("/api/widgets", "POST", { title: "Blocked", html: "<html></html>" }, memberLogin.cookie)).status, 403);
    assert.equal((await call("/api/generate", "POST", { prompt: "Blocked" }, memberLogin.cookie)).status, 403);
    stage = "isolation";
    const second = await call("/api/workspaces", "POST", {
      name: "Other verification", workspaceId: secondId, adminPassword: "AdminTestPass123!", memberPassword: "MemberTestPass123!",
    });
    assert.equal(second.status, 201);
    assert.equal((await call(query, "GET", undefined, second.cookie)).status, 404);
    stage = "delete";
    assert.equal((await call(`/api/widgets/${savedWidgetId}`, "DELETE", undefined, adminCookie)).status, 200);
    assert.deepEqual((await call("/api/widgets", "GET", undefined, adminCookie)).json.data.widgets, []);
    console.log("PASS: workspace creation, sessions, roles, widgets, shared storage, and cross-workspace isolation.");
  } finally {
    try {
      const db = await getDatabase();
      for (const id of [workspaceId, secondId]) {
        await db.collection("widgetData").deleteMany({ workspaceId: id });
        await db.collection("widgets").deleteMany({ workspaceId: id });
        await db.collection("workspaces").deleteOne({ _id: id } as never);
      }
    } finally { await closeDatabase(); }
    console.log("Verification workspaces removed.");
  }
}
main().catch(() => { console.error("API verification failed at", stage); process.exitCode = 1; });
