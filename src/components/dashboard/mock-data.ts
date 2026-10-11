import type { Task, Widget, Workspace } from "@/types/contracts";

// Removable Phase 1 fixtures; no authentication or persistence is simulated.
export const mockWorkspace: Workspace = { id: "launch-team", name: "Launch team", role: "admin" };
const timestamp = "2026-10-11T16:00:00.000Z";
export const mockTasks: Task[] = [
  { id: "task-1", title: "Choose our next team tool", description: "A small idea with a big impact.", status: "todo", createdAt: timestamp, updatedAt: timestamp },
  { id: "task-2", title: "Outline the product demo", description: "Tell our story in 90 seconds.", status: "todo", createdAt: timestamp, updatedAt: timestamp },
  { id: "task-3", title: "Build the shared workspace", description: "Bring tasks and tools together.", status: "in_progress", createdAt: timestamp, updatedAt: timestamp },
  { id: "task-4", title: "Agree on team interfaces", description: "One foundation. Three teammates.", status: "done", createdAt: timestamp, updatedAt: timestamp },
];
export const mockWidgets: Widget[] = [
  { id: "sample-poll", title: "What should we build next?", html: "", createdAt: timestamp },
  { id: "sample-calculator", title: "Meeting cost calculator", html: "", createdAt: timestamp },
];

export async function mockGenerateWidget(prompt: string): Promise<Widget> {
  await new Promise((resolve) => setTimeout(resolve, 900));
  return { id: crypto.randomUUID(), title: prompt.length > 65 ? `${prompt.slice(0, 62)}…` : prompt, html: "", createdAt: new Date().toISOString() };
}

export function readPreviewWidgets(snapshot?: string | null): Widget[] {
  try {
    const saved = snapshot === undefined ? sessionStorage.getItem("workspacezero.preview-widgets") : snapshot;
    if (saved) {
      const parsed: unknown = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.every((item) => item && typeof item.id === "string" && typeof item.title === "string" && typeof item.html === "string")) return parsed;
    }
  } catch { /* Preview storage may be unavailable. */ }
  return mockWidgets;
}
