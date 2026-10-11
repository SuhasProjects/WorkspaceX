import { checkOrigin, failure, onlyFields, readJsonObject, success, HttpError } from "@/lib/auth/http";
import { requireSession } from "@/lib/auth/session";
import { getWidget, listWidgets } from "@/lib/db/repository";
import { generateWidget, GenerationError } from "@/lib/luminal/generate";

export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const session = await requireSession("admin");
    const body = await readJsonObject(request, 256 * 1024);
    onlyFields(body, ["prompt", "baseHtml", "referenceId"]);
    if (typeof body.prompt !== "string" || (body.baseHtml !== undefined && typeof body.baseHtml !== "string")) {
      throw new HttpError(400, "INVALID_INPUT", "Prompt and optional base HTML must be strings.");
    }
    if (body.referenceId !== undefined && (typeof body.referenceId !== "string" || !/^[0-9a-f-]{36}$/.test(body.referenceId))) {
      throw new HttpError(400, "INVALID_INPUT", "referenceId must be a widget id.");
    }
    // Appearance examples for new tools: the admin's chosen tool, else the two most recent.
    // Edits already carry their own code and get no references.
    let references: { title: string; html: string }[] = [];
    if (body.baseHtml === undefined) {
      if (typeof body.referenceId === "string") {
        const chosen = await getWidget(session.workspaceId, body.referenceId);
        if (!chosen) throw new HttpError(404, "NOT_FOUND", "Reference widget not found.");
        references = [{ title: chosen.title, html: chosen.html }];
      } else {
        references = (await listWidgets(session.workspaceId)).slice(-2).map(({ title, html }) => ({ title, html }));
      }
    }
    return success(await generateWidget(body.prompt, body.baseHtml, references));
  } catch (error) {
    if (error instanceof GenerationError) {
      const status = { INVALID_INPUT: 400, SERVICE_UNAVAILABLE: 503, RATE_LIMITED: 429,
        GENERATION_FAILED: 502, GENERATION_TIMEOUT: 504 }[error.code];
      return failure(new HttpError(status, error.code, error.message));
    }
    return failure(error);
  }
}
