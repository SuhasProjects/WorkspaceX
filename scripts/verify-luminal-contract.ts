import assert from "node:assert/strict";

async function main() {
  process.env.LUMINAL_API_KEY = "local-test-key";
  process.env.LUMINAL_BASE_URL = "https://example.invalid/v1";
  process.env.LUMINAL_MODEL = "local-test-model";
  const { generateWidget } = await import("../src/lib/luminal/generate");
  const { buildGenerationMessages } = await import("../src/lib/widget-protocol/generation-contract");
  const { THEME_TOKENS, TOKEN_NAMES } = await import("../src/lib/widget-protocol/theme");
  const sent: Record<string, unknown>[] = [];
  globalThis.fetch = async (_input, init) => {
    sent.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
    return Response.json({ choices: [{ message: { content:
      "```html\n<!DOCTYPE html><html><head><title>Team Poll</title><meta name=\"workspacezero:size\" content=\"small\"></head><body><button>Vote</button><img src=\"https://example.invalid/icon.png\"></body></html>\n```" } }] });
  };
  const widget = await generateWidget("Create a shared poll");
  assert.equal(widget.title, "Team Poll");
  assert.equal(widget.size, "small");
  assert.match(widget.html, /^<!DOCTYPE html>/);
  const { parseModelOutput } = await import("../src/lib/widget-protocol/generation-contract");
  const fragment = parseModelOutput("<main>Small generated tool</main>");
  assert.equal(fragment.ok, true);
  if (fragment.ok) {
    assert.match(fragment.widget.html, /^<!DOCTYPE html><html><head>[\s\S]*<body>[\s\S]*<\/body><\/html>$/);
    assert.equal(fragment.widget.size, "medium");
    assert.match(fragment.warnings.join(" "), /defaulted to medium/i);
  }
  assert.deepEqual(sent[0]?.messages, buildGenerationMessages({ prompt: "Create a shared poll" }));
  assert.equal(sent[0]?.model, "local-test-model");
  assert.equal(sent[0]?.temperature, 0.2);
  assert.equal(TOKEN_NAMES.length, 25);
  for (const name of ["--wz-blue", "--wz-cyan", "--wz-teal", "--wz-yellow", "--wz-orange", "--wz-red", "--wz-purple", "--wz-pink"]) {
    assert.ok(THEME_TOKENS.light[name], `Missing light token ${name}`);
    assert.ok(THEME_TOKENS.dark[name], `Missing dark token ${name}`);
  }
  assert.match(JSON.stringify(sent[0]?.messages), /--wz-purple/);
  await generateWidget("Make the vote button blue", widget.html);
  assert.deepEqual(sent[1]?.messages, buildGenerationMessages({ prompt: "Make the vote button blue", baseHtml: widget.html }));
  assert.equal(sent[1]?.temperature, 0.2);
  console.log("PASS: Luminal create/edit requests use the shared generation contract and low temperature.");
}
main().catch(() => { console.error("Luminal contract check failed."); process.exitCode = 1; });
