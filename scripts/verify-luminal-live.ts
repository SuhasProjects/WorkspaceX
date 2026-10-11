import { loadEnvConfig } from "@next/env";

async function main() {
  loadEnvConfig(process.cwd());
  const { generateWidget } = await import("../src/lib/luminal/generate");
  const widget = await generateWidget("Create a compact shared team poll: Which feature should we build next? Choices: Search, Export, Themes. Use workspace shared storage for votes.");
  console.log(`PASS: Luminal generated a complete widget titled "${widget.title}" (${Buffer.byteLength(widget.html, "utf8")} bytes).`);
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