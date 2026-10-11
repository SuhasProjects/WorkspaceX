import "server-only";
import type { GeneratedWidget } from "@/types/contracts";
import { WIDGET_SYSTEM_PROMPT, parseModelOutput } from "@/lib/widget-protocol/generation-contract";

export type GenerationErrorCode =
  | "INVALID_INPUT"
  | "SERVICE_UNAVAILABLE"
  | "RATE_LIMITED"
  | "GENERATION_FAILED"
  | "GENERATION_TIMEOUT";

export class GenerationError extends Error {
  constructor(public readonly code: GenerationErrorCode, message: string, public readonly providerStatus?: number) {
    super(message);
    this.name = "GenerationError";
  }
}

const MAX_PROMPT_CHARACTERS = 4_000;
const MAX_HTML_BYTES = 100 * 1024;
const TIMEOUT_MS = 45_000;

type ChatCompletion = {
  choices?: Array<{ message?: { content?: unknown } }>;
};

function providerConfig() {
  const apiKey = process.env.LUMINAL_API_KEY?.trim();
  const base = process.env.LUMINAL_BASE_URL?.trim();
  const model = process.env.LUMINAL_MODEL?.trim();
  if (!apiKey || !base || !model) {
    throw new GenerationError("SERVICE_UNAVAILABLE", "Luminal configuration is incomplete.");
  }
  let baseUrl: URL;
  try {
    baseUrl = new URL(base);
    if (baseUrl.protocol !== "https:" || baseUrl.username || baseUrl.password || baseUrl.search || baseUrl.hash) {
      throw new Error("Invalid provider URL");
    }
  } catch {
    throw new GenerationError("SERVICE_UNAVAILABLE", "Luminal base URL is invalid.");
  }
  // LUMINAL_BASE_URL is the provider's verified OpenAI-compatible base URL,
  // normally ending in /v1. The request path is appended exactly once.
  const endpoint = new URL(`${baseUrl.pathname.replace(/\/$/, "")}/chat/completions`, baseUrl.origin);
  return { apiKey, model, endpoint };
}

/** Server-only generation. A future admin-authenticated route will call this. */
export async function generateWidget(prompt: string): Promise<GeneratedWidget> {
  if (typeof prompt !== "string" || !prompt.trim() || prompt.trim().length > MAX_PROMPT_CHARACTERS) {
    throw new GenerationError("INVALID_INPUT", "Prompt must contain 1 to 4,000 characters.");
  }
  const { apiKey, model, endpoint } = providerConfig();
  const messages = [
    { role: "system", content: WIDGET_SYSTEM_PROMPT },
    { role: "user", content: prompt.trim() },
  ];
  let response: Response | undefined;
  for (const maxTokens of [3_500, 2_200]) {
    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          messages,
          max_tokens: maxTokens,
          thinking: { type: "disabled" },
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (error) {
      if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
        throw new GenerationError("GENERATION_TIMEOUT", "Widget generation timed out.");
      }
      throw new GenerationError("SERVICE_UNAVAILABLE", "Luminal could not be reached.");
    }
    if (response.status !== 503) break;
  }
  if (!response) throw new GenerationError("SERVICE_UNAVAILABLE", "Luminal could not be reached.");
  if (response.status === 429) throw new GenerationError("RATE_LIMITED", "Luminal is busy. Try again shortly.", response.status);
  if (response.status === 503) {
    throw new GenerationError("SERVICE_UNAVAILABLE", "Luminal is temporarily unavailable. Try again shortly.", response.status);
  }
  if (!response.ok) throw new GenerationError("GENERATION_FAILED", "Luminal could not generate a widget.", response.status);

  let completion: ChatCompletion;
  try {
    completion = await response.json() as ChatCompletion;
  } catch {
    throw new GenerationError("GENERATION_FAILED", "Luminal returned an invalid response.");
  }
  const raw = completion?.choices?.[0]?.message?.content;
  if (typeof raw !== "string") {
    throw new GenerationError("GENERATION_FAILED", "Luminal returned no widget document.");
  }
  const parsed = parseModelOutput(raw);
  if (!parsed.ok) throw new GenerationError("GENERATION_FAILED", "Luminal did not return a usable widget document.");
  const { title, html } = parsed.widget;
  if (!title || title.length > 120 || Buffer.byteLength(html, "utf8") > MAX_HTML_BYTES) {
    throw new GenerationError("GENERATION_FAILED", "Luminal returned an incompatible widget document.");
  }
  return { title, html };
}
