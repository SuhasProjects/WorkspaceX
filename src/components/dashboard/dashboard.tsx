"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { WorkspaceAccess } from "@/components/auth/workspace-access";
import { AIBuilderPanel } from "@/components/builder/ai-builder-panel";
import { TaskBoard } from "@/components/tasks/task-board";
import type { ApiResponse, GeneratedWidget, Theme, Widget } from "@/types/contracts";
import { Icon } from "./icon";
import { mockTasks } from "./mock-data";
import { Calendar } from "./calendar";
import { TodoList } from "@/components/tasks/todo-list";
import { WorkspaceHeader } from "./workspace-header";
import { useWorkspaceWidgets } from "./use-workspace-widgets";

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
  const [tasks, setTasks] = useState(mockTasks);
  const [preview, setPreview] = useState<GeneratedWidget | null>(null);
  const [theme, setTheme] = useState<Theme>("light");
  const router = useRouter();
  const { state, retry } = useWorkspaceWidgets();

  useEffect(() => {
    try { setTheme(localStorage.getItem("workspacezero.theme") === "dark" ? "dark" : "light"); }
    catch { /* Keep the default when browser storage is unavailable. */ }
  }, []);

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
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    try { localStorage.setItem("workspacezero.theme", next); } catch {}
    window.dispatchEvent(new Event("workspacezero:theme"));
  }
  function toggleTask(id: string) {
    if (workspace.role !== "admin") return;
    setTasks((current) => current.map((task) => task.id === id ? { ...task, status: task.status === "done" ? "todo" : "done" } : task));
  }

  return <div className="dashboard-shell" data-theme={theme}><a className="skip-link" href="#main">Skip to workspace</a><WorkspaceHeader workspace={workspace} theme={theme} onTheme={toggleTheme} onLogout={logout} />
    <main id="main" className="dashboard-main"><div className="workspace-intro"><div><p className="eyebrow"><span className="live-dot" />YOUR SHARED SPACE</p><h1>Less setup. More doing.</h1><p>Keep your team&apos;s tasks and little tools in one happy place.</p></div><div className="intro-tag"><Icon name="people" size={17} /><span>Small team. Big possibilities.</span></div></div>
      <div className="dashboard-grid"><div className="workspace-content"><div className="overview-grid"><Calendar /><TodoList tasks={tasks} canEdit={workspace.role === "admin"} onToggle={toggleTask} /></div><TaskBoard tasks={tasks} />
        <section className="section-block tools-section" aria-labelledby="tools-heading"><div className="section-heading"><div><h2 id="tools-heading">Team tools <span className="count-badge">{widgets.length}</span></h2><p>Small software, made for the way you work.</p></div>{workspace.role === "admin" && <a href="#tool-prompt" className="text-link"><Icon name="plus" size={15} />Create a tool</a>}</div>
          {widgets.length ? <nav className="tool-directory" aria-label="Open a team tool">{widgets.map((widget) => <Link key={widget.id} href={`/widgets/${encodeURIComponent(widget.id)}`}><Icon name="grid" size={17} /><span>{widget.title}</span><small>Open tool</small><Icon name="arrow" size={15} /></Link>)}</nav> : <div className="empty-tools"><Icon name="sparkle" size={30} /><h3>Your next idea starts here.</h3><p>Describe a tool in the builder to give it a page of its own.</p></div>}
        </section>
      </div><AIBuilderPanel isAdmin={workspace.role === "admin"} workspaceId={workspace.id} theme={theme} preview={preview} onGenerate={generate} onSave={save} onDiscard={() => setPreview(null)} /></div>
      <footer className="dashboard-footer"><span>WorkspaceZero · Small software. Shared workspace.</span><span>AI tools, shared with your team</span></footer>
    </main>
  </div>;
}
