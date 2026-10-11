import type { Account, Widget, Workspace } from "@/types/contracts";
import { TEST_WIDGETS } from "@/components/widget-engine";

const sampleHtml = (id: string) => TEST_WIDGETS.find((w) => w.id === id)?.html ?? "";

// Removable Phase 1 fixtures; no authentication or persistence is simulated.
export const mockAccount: Account = { id: "00000000-0000-4000-8000-000000000000", username: "preview", plan: "free", subscription: { plan: "free", status: "none", updatedAt: "2026-10-11T16:00:00.000Z" } };
export const mockWorkspace: Workspace = { id: "launch-team", name: "Launch team", role: "owner", ownerId: mockAccount.id, plan: "free" };
const timestamp = "2026-10-11T16:00:00.000Z";
export const mockWidgets: Widget[] = [
  { id: "sample-poll", title: "What should we build next?", html: sampleHtml("test-poll"), size: "small", createdAt: timestamp },
  { id: "sample-expenses", title: "Team expense tracker", html: sampleHtml("test-expenses"), size: "medium", createdAt: timestamp },
];

export async function mockGenerateWidget(prompt: string): Promise<Widget> {
  await new Promise((resolve) => setTimeout(resolve, 900));
  return { id: crypto.randomUUID(), title: prompt.length > 65 ? `${prompt.slice(0, 62)}…` : prompt, html: "", size: "medium", createdAt: new Date().toISOString() };
}

export function readPreviewWidgets(snapshot?: string | null): Widget[] {
  try {
    const saved = snapshot === undefined ? sessionStorage.getItem("workspacezero.preview-widgets") : snapshot;
    if (saved) {
      const parsed: unknown = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.every((item) => item && typeof item.id === "string" && typeof item.title === "string" && typeof item.html === "string")) {
        return parsed.map((item) => ({ ...item, size: item.size === "small" || item.size === "medium" || item.size === "large" ? item.size : "large" }));
      }
    }
  } catch { /* Preview storage may be unavailable. */ }
  return mockWidgets;
}
