"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { WorkspaceAccess } from "@/components/auth/workspace-access";
import { AIBuilderPanel } from "@/components/builder/ai-builder-panel";
import { TaskBoard } from "@/components/tasks/task-board";
import type { ApiResponse, GeneratedWidget, Task, TaskStatus, Widget } from "@/types/contracts";
import { Icon } from "./icon";
import { Calendar } from "./calendar";
import { TodoList } from "@/components/tasks/todo-list";
import { WorkspaceHeader } from "./workspace-header";
import { setWidgetTheme, useWidgetTheme, useWorkspaceWidgets } from "./use-workspace-widgets";
import { Atmosphere } from "./atmosphere";

async function post<T>(url: string, body?: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const result = await response.json() as ApiResponse<T>;
  if (!response.ok || !result.data) {
    throw new Error(result.error?.message ?? "The request could not be completed.");
  }
  return result.data;
}

export function Dashboard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskBusy, setTaskBusy] = useState(false);
  const [taskMessage, setTaskMessage] = useState("");
  const [preview, setPreview] = useState<GeneratedWidget | null>(null);
  const theme = useWidgetTheme();
  const router = useRouter();
  const { state, retry } = useWorkspaceWidgets();
  const workspaceId = state.status === "ready" ? state.workspace.id : null;

  useEffect(() => {
    if (!workspaceId) return;
    const controller = new AbortController();
    fetch("/api/tasks", { signal: controller.signal, cache: "no-store", credentials: "same-origin" })
      .then(async (response) => {
        const result = await response.json() as ApiResponse<{ tasks: Task[] }>;
        if (!response.ok || !result.data) throw new Error(result.error?.message ?? "Tasks could not be loaded.");
        return result.data.tasks;
      })
      .then((loaded) => { if (!controller.signal.aborted) setTasks(loaded); })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setTaskMessage(error instanceof Error ? error.message : "Tasks could not be loaded.");
      });
    return () => controller.abort();
  }, [workspaceId]);

  if (state.status === "loading") return <main className="page-state min-h-screen" role="status"><span className="spinner" /><p>Opening your workspace…</p></main>;
  if (state.status === "signed_out") return <WorkspaceAccess onSuccess={retry} />;
  if (state.status === "error") return <main className="page-state min-h-screen" role="alert"><h1>Unable to open workspace</h1><p>{state.message}</p><button type="button" onClick={retry}>Try again</button></main>;

  const { workspace, widgets } = state;

  async function generate(prompt: string) {
    setPreview(await post<GeneratedWidget>("/api/generate", { prompt }));
  }
  async function save() {
    if (!preview) return;
    const data = await post<{ widget: Widget }>("/api/widgets", preview);
    setPreview(null);
    retry();
    router.push(`/widgets/${encodeURIComponent(data.widget.id)}`);
  }
  async function logout() {
    await post<{ success: true }>("/api/auth/logout");
    setPreview(null);
    retry();
  }
  function toggleTheme() {
    setWidgetTheme(theme === "dark" ? "light" : "dark");
  }
  async function createTask(title: string, description: string, dueDate: string) {
    if (workspace.role !== "admin") return false;
    setTaskBusy(true); setTaskMessage("");
    try {
      const data = await post<{ task: Task }>("/api/tasks", { title, ...(description ? { description } : {}), ...(dueDate ? { dueDate } : {}) });
      setTasks((current) => [...current, data.task]);
      return true;
    } catch (error) {
      setTaskMessage(error instanceof Error ? error.message : "Task could not be created.");
      return false;
    } finally { setTaskBusy(false); }
  }
  async function updateTaskStatus(id: string, status: TaskStatus) {
    if (workspace.role !== "admin") return;
    setTaskBusy(true); setTaskMessage("");
    try {
      const response = await fetch(`/api/tasks/${encodeURIComponent(id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ status }) });
      const result = await response.json() as ApiResponse<{ task: Task }>;
      if (!response.ok || !result.data) throw new Error(result.error?.message ?? "Task could not be updated.");
      setTasks((current) => current.map((task) => task.id === id ? result.data!.task : task));
    } catch (error) { setTaskMessage(error instanceof Error ? error.message : "Task could not be updated."); }
    finally { setTaskBusy(false); }
  }
  async function deleteTask(id: string) {
    if (workspace.role !== "admin") return;
    setTaskBusy(true); setTaskMessage("");
    try {
      const response = await fetch(`/api/tasks/${encodeURIComponent(id)}`, { method: "DELETE", credentials: "same-origin" });
      const result = await response.json() as ApiResponse<{ success: true }>;
      if (!response.ok || !result.data) throw new Error(result.error?.message ?? "Task could not be deleted.");
      setTasks((current) => current.filter((task) => task.id !== id));
    } catch (error) { setTaskMessage(error instanceof Error ? error.message : "Task could not be deleted."); }
    finally { setTaskBusy(false); }
  }
  function toggleTask(id: string) {
    const task = tasks.find((item) => item.id === id);
    if (task) void updateTaskStatus(id, task.status === "done" ? "todo" : "done");
  }

  return <div className="dashboard-shell" data-theme={theme}><Atmosphere /><a className="skip-link" href="#main">Skip to workspace</a><WorkspaceHeader workspace={workspace} theme={theme} onTheme={toggleTheme} onLogout={logout} />
    <main id="main" className="dashboard-main"><div className="workspace-intro"><div><h1>{workspace.name}</h1></div></div>
      <section className="workspace-tabs" aria-label="Workspace pages">
        <nav className="workspace-tab-list">
          <Link href="/" aria-current="page">Dashboard</Link>
          {widgets.map((widget) => <Link key={widget.id} href={`/widgets/${encodeURIComponent(widget.id)}`}>{widget.title}</Link>)}
        </nav>
        {workspace.role === "admin" && <a href="#tool-prompt" className="workspace-tab-action"><Icon name="plus" size={14} />New tool</a>}
      </section>
      <div className="dashboard-grid"><div className="workspace-content"><div className="overview-grid"><Calendar /><TodoList tasks={tasks} canEdit={workspace.role === "admin" && !taskBusy} onToggle={toggleTask} /></div><TaskBoard tasks={tasks} canEdit={workspace.role === "admin"} busy={taskBusy} message={taskMessage} onCreate={createTask} onStatus={(id, status) => void updateTaskStatus(id, status)} onDelete={(id) => void deleteTask(id)} />
      </div><AIBuilderPanel isAdmin={workspace.role === "admin"} workspaceId={workspace.id} theme={theme} preview={preview} onGenerate={generate} onSave={save} onDiscard={() => setPreview(null)} /></div>
      <footer className="dashboard-footer"><span>WorkspaceZero · Small software. Shared workspace.</span><span>AI tools, shared with your team</span></footer>
    </main>
  </div>;
}
