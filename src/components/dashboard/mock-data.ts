import type { Widget, Workspace } from "@/types/contracts";
import { TEST_WIDGETS } from "@/components/widget-engine";

const sampleHtml = (id: string) => TEST_WIDGETS.find((w) => w.id === id)?.html ?? "";

// Removable Phase 1 fixtures; no authentication or persistence is simulated.
export const mockWorkspace: Workspace = { id: "launch-team", name: "Launch team", role: "admin" };
const timestamp = "2026-10-11T16:00:00.000Z";
export const mockWidgets: Widget[] = [
  { id: "sample-poll", title: "What should we build next?", html: sampleHtml("test-poll"), createdAt: timestamp },
  { id: "sample-expenses", title: "Team expense tracker", html: sampleHtml("test-expenses"), createdAt: timestamp },
];

export async function mockGenerateWidget(prompt: string): Promise<Widget> {
  await new Promise((resolve) => setTimeout(resolve, 900));
  return { id: crypto.randomUUID(), title: prompt.length > 65 ? `${prompt.slice(0, 62)}…` : prompt, html: "", createdAt: new Date().toISOString() };
}

export function readPreviewWidgets(): Widget[] {
  try {
    const saved = sessionStorage.getItem("workspacezero.preview-widgets");
    if (saved) {
      const parsed: unknown = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.every((item) => item && typeof item.id === "string" && typeof item.title === "string" && typeof item.html === "string")) return parsed;
    }
  } catch { /* Preview storage may be unavailable. */ }
  return mockWidgets;
}
