import { loadEnvConfig } from "@next/env";

async function main() {
  loadEnvConfig(process.cwd());
  const { generateWidget } = await import("../src/lib/luminal/generate");
  const baseHtml = "<!DOCTYPE html><html><head><title>Team Poll</title></head><body><h1>Team Poll</h1><button>Vote</button></body></html>";
  const widget = await generateWidget("Change only the heading to Feature Poll.", baseHtml);
  if (!widget.html.includes("Feature Poll")) throw new Error("Luminal did not apply the requested edit.");
  console.log(`PASS: Luminal edited a complete widget titled "${widget.title}" (${Buffer.byteLength(widget.html, "utf8")} bytes).`);
}

main().catch((error: unknown) => {
  const code = error instanceof Error && "code" in error ? String(error.code) : "UNKNOWN";
  console.error(`Luminal live verification failed: ${code}.`);
  if (error instanceof Error && error.name === "GenerationError") {
    console.error(error.message);
    if ("providerStatus" in error) console.error(`Provider status: ${error.providerStatus}`);
  }
  process.exitCode = 1;
});
