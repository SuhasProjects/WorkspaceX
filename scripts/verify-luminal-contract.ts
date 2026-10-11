import assert from "node:assert/strict";

async function main() {
  process.env.LUMINAL_API_KEY = "local-test-key";
  process.env.LUMINAL_BASE_URL = "https://example.invalid/v1";
  process.env.LUMINAL_MODEL = "local-test-model";
  const { generateWidget } = await import("../src/lib/luminal/generate");
  const { WIDGET_SYSTEM_PROMPT } = await import("../src/lib/widget-protocol/generation-contract");
  let sent: Record<string, unknown> | undefined;
  globalThis.fetch = async (_input, init) => {
    sent = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return Response.json({ choices: [{ message: { content:
      "```html\n<!DOCTYPE html><html><head><title>Team Poll</title></head><body><button>Vote</button></body></html>\n```" } }] });
  };
  const widget = await generateWidget("Create a shared poll");
  assert.equal(widget.title, "Team Poll");
  assert.match(widget.html, /^<!DOCTYPE html>/);
  assert.deepEqual(sent?.messages, [
    { role: "system", content: WIDGET_SYSTEM_PROMPT },
    { role: "user", content: "Create a shared poll" },
  ]);
  assert.equal(sent?.model, "local-test-model");
  console.log("PASS: Luminal request uses the widget engine prompt and parses its HTML contract.");
}
main().catch(() => { console.error("Luminal contract check failed."); process.exitCode = 1; });