import { checkOrigin, failure, onlyFields, readJsonObject, success, HttpError } from "@/lib/auth/http";
import { requireSession } from "@/lib/auth/session";
import { generateWidget, GenerationError } from "@/lib/luminal/generate";

export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    await requireSession("admin");
    const body = await readJsonObject(request, 256 * 1024);
    onlyFields(body, ["prompt", "baseHtml"]);
    if (typeof body.prompt !== "string" || (body.baseHtml !== undefined && typeof body.baseHtml !== "string")) {
      throw new HttpError(400, "INVALID_INPUT", "Prompt and optional base HTML must be strings.");
    }
    return success(await generateWidget(body.prompt, body.baseHtml));
  } catch (error) {
    if (error instanceof GenerationError) {
      const status = { INVALID_INPUT: 400, SERVICE_UNAVAILABLE: 503, RATE_LIMITED: 429,
        GENERATION_FAILED: 502, GENERATION_TIMEOUT: 504 }[error.code];
      return failure(new HttpError(status, error.code, error.message));
    }
    return failure(error);
  }
}
