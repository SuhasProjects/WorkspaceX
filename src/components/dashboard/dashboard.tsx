"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { WorkspaceAccess } from "@/components/auth/workspace-access";
import { AIBuilderPanel } from "@/components/builder/ai-builder-panel";
import { TaskBoard } from "@/components/tasks/task-board";
import type { ApiResponse, GeneratedWidget, Task, TaskStatus, UpdateTaskRequest, Widget, WidgetSize } from "@/types/contracts";
import { Icon } from "./icon";
import { Calendar } from "./calendar";
import { TodoList } from "@/components/tasks/todo-list";
import { WorkspaceHeader } from "./workspace-header";
import { setWidgetTheme, useWidgetTheme, useWorkspaceWidgets } from "./use-workspace-widgets";
import { Atmosphere } from "./atmosphere";
import { ToolManageBar } from "./tool-manage-bar";
import { ToolEditor } from "./tool-editor";
import { WidgetRenderer } from "./widget-renderer-adapter";
import { setActiveTool, useActiveTool } from "./use-active-tool";
import { WidgetGallery } from "./widget-gallery";

const WIDGET_GALLERY_ID = "widgets";

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
  const [selectedDueDate, setSelectedDueDate] = useState<string | null>(null);
  const [preview, setPreview] = useState<GeneratedWidget | null>(null);
  const [builderOpen, setBuilderOpen] = useState(false);
  const theme = useWidgetTheme();
  const { state, retry, reorderWidget, removeWidget, duplicateWidget, updateWidget, updateWidgetSize, updateWidgetSpan } = useWorkspaceWidgets();
  const [editingTool, setEditingTool] = useState<string | null>(null);
  const [orderError, setOrderError] = useState("");
  const [dragging, setDragging] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const workspaceId = state.status === "ready" ? state.workspace.id : null;
  const activeTool = useActiveTool();

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
  const compactWidgets = widgets.filter((widget) => widget.size !== "large");
  const largeWidgets = widgets.filter((widget) => widget.size === "large");
  const selectedWidget = activeTool ? widgets.find((widget) => widget.id === activeTool) ?? null : null;
  const activeWidget = selectedWidget?.size === "large" ? selectedWidget : null;
  const showingGallery = activeTool === WIDGET_GALLERY_ID || (selectedWidget !== null && selectedWidget.size !== "large");

  async function generate(prompt: string, referenceId?: string) {
    setPreview(await post<GeneratedWidget>("/api/generate", referenceId ? { prompt, referenceId } : { prompt }));
  }
  async function save() {
    if (!preview) return;
    const data = await post<{ widget: Widget }>("/api/widgets", preview);
    setPreview(null);
    retry();
    setActiveTool(data.widget.size === "large" ? data.widget.id : WIDGET_GALLERY_ID);
  }
  async function logout() {
    await post<{ success: true }>("/api/auth/logout");
    setPreview(null);
    retry();
  }
  function toggleTheme() {
    setWidgetTheme(theme === "dark" ? "light" : "dark");
  }
  async function createTask(title: string, description: string, dueDate: string, dueTime: string) {
    setTaskBusy(true); setTaskMessage("");
    try {
      const data = await post<{ task: Task }>("/api/tasks", { title, ...(description ? { description } : {}), ...(dueDate ? { dueDate } : {}), ...(dueDate && dueTime ? { dueTime } : {}) });
      setTasks((current) => [...current, data.task]);
      return true;
    } catch (error) {
      setTaskMessage(error instanceof Error ? error.message : "Task could not be created.");
      return false;
    } finally { setTaskBusy(false); }
  }
  async function updateTask(id: string, updates: UpdateTaskRequest) {
    if (workspace.role !== "admin") return false;
    setTaskBusy(true); setTaskMessage("");
    try {
      const response = await fetch(`/api/tasks/${encodeURIComponent(id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify(updates) });
      const result = await response.json() as ApiResponse<{ task: Task }>;
      if (!response.ok || !result.data) throw new Error(result.error?.message ?? "Task could not be updated.");
      setTasks((current) => current.map((task) => task.id === id ? result.data!.task : task));
      return true;
    } catch (error) {
      setTaskMessage(error instanceof Error ? error.message : "Task could not be updated.");
      return false;
    }
    finally { setTaskBusy(false); }
  }
  async function updateTaskStatus(id: string, status: TaskStatus) {
    await updateTask(id, { status });
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
  async function changeWidgetSize(id: string, size: WidgetSize) {
    return updateWidgetSize(id, size);
  }

  return <div className="dashboard-shell" data-theme={theme}><Atmosphere /><a className="skip-link" href="#main">Skip to workspace</a><WorkspaceHeader workspace={workspace} theme={theme} onTheme={toggleTheme} onLogout={logout} />
    <main id="main" className="dashboard-main dashboard-home" aria-label={workspace.name}>
      <section className="workspace-tabs" aria-label="Workspace pages">
        <nav className="workspace-tab-list">
          <Link href="/" aria-current={!activeTool ? "page" : undefined} onClick={(event) => { event.preventDefault(); setActiveTool(null); }}>Dashboard</Link>
          <a href={`/?tool=${WIDGET_GALLERY_ID}`} aria-current={showingGallery ? "page" : undefined} onClick={(event) => { event.preventDefault(); setActiveTool(WIDGET_GALLERY_ID); }}>Widgets <span className="tab-count">{compactWidgets.length}</span></a>
          {largeWidgets.map((widget) => <Link key={widget.id} href={`/?tool=${encodeURIComponent(widget.id)}`}
            onNavigate={(event) => { event.preventDefault(); setActiveTool(widget.id); }}
            aria-current={widget.id === activeTool ? "page" : undefined}
            className={`${dragging === widget.id ? "is-dragging" : ""} ${dropTarget === widget.id ? "is-drop-target" : ""}`}
            draggable={workspace.role === "admin"}
            onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", widget.id); setDragging(widget.id); }}
            onDragOver={(event) => { if (!dragging) return; event.preventDefault(); event.dataTransfer.dropEffect = "move"; if (dropTarget !== widget.id) setDropTarget(widget.id); }}
            onDragLeave={() => { if (dropTarget === widget.id) setDropTarget(null); }}
            onDrop={(event) => { event.preventDefault(); if (dragging) void reorderWidget(dragging, widget.id).then((message) => setOrderError(message ?? "")); setDragging(null); setDropTarget(null); }}
            onDragEnd={() => { setDragging(null); setDropTarget(null); }}
            title={workspace.role === "admin" ? "Drag to reorder" : undefined}>{widget.title}</Link>)}
        </nav>
        {workspace.role === "admin" && <a href="#tool-builder" className="workspace-tab-action" onClick={() => { setActiveTool(null); setBuilderOpen(true); }}><Icon name="plus" size={14} />New tool</a>}
      </section>
      {activeWidget ? <section className="tool-pane" aria-label={activeWidget.title}>
        {workspace.role === "admin" && <ToolManageBar widget={activeWidget} onDelete={removeWidget} onDuplicate={duplicateWidget} onSize={changeWidgetSize} onDeleted={() => setActiveTool(null)} editing={editingTool === activeWidget.id} onEdit={() => setEditingTool(editingTool === activeWidget.id ? null : activeWidget.id)} />}
        {orderError && <p className="widget-tools-confirm" role="alert">{orderError}</p>}
        {workspace.role === "admin" && editingTool === activeWidget.id
          ? <ToolEditor key={activeWidget.id} widget={activeWidget} workspaceId={workspace.id} theme={theme} onClose={() => setEditingTool(null)} onSaved={(saved) => { updateWidget(saved); setEditingTool(null); }} />
          : <WidgetRenderer key={`${workspace.id}:${activeWidget.id}:${activeWidget.html.length}`} widgetId={activeWidget.id} workspaceId={workspace.id} html={activeWidget.html} theme={theme} title={activeWidget.title} className="tool-pane-frame" />}
      </section> : showingGallery ? <WidgetGallery widgets={compactWidgets} workspaceId={workspace.id} theme={theme} isAdmin={workspace.role === "admin"} onSpan={updateWidgetSpan} onDelete={removeWidget} onDuplicate={duplicateWidget} onSize={changeWidgetSize} onUpdate={updateWidget} /> : <div className="dashboard-grid"><div className="workspace-content"><div className="overview-grid"><Calendar tasks={tasks} selectedDueDate={selectedDueDate} onSelectDueDate={setSelectedDueDate} /><TodoList tasks={tasks} canEdit={workspace.role === "admin" && !taskBusy} selectedDueDate={selectedDueDate} onClearDate={() => setSelectedDueDate(null)} onToggle={toggleTask} /></div><TaskBoard tasks={tasks} canEdit={workspace.role === "admin"} canCreate busy={taskBusy} message={taskMessage} onCreate={createTask} onUpdate={updateTask} onStatus={(id, status) => void updateTaskStatus(id, status)} onDelete={(id) => void deleteTask(id)} />
      </div>{workspace.role === "admin" && <AIBuilderPanel isAdmin referenceOptions={widgets.map(({ id, title }) => ({ id, title }))} expanded={builderOpen} onToggle={() => setBuilderOpen((current) => !current)} workspaceId={workspace.id} theme={theme} preview={preview} onGenerate={generate} onSave={save} onDiscard={() => setPreview(null)} />}</div>}
      <footer className="dashboard-footer"><span>WorkspaceZero · Small software. Shared workspace.</span><span>AI tools, shared with your team</span></footer>
    </main>
  </div>;
}
