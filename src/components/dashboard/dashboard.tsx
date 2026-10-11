"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AIBuilderPanel } from "@/components/builder/ai-builder-panel";
import { TaskBoard } from "@/components/tasks/task-board";
import { Icon } from "./icon";
import { mockGenerateWidget, mockTasks, mockWidgets, mockWorkspace, readPreviewWidgets } from "./mock-data";
import { Calendar } from "./calendar";
import { TodoList } from "@/components/tasks/todo-list";
import { WorkspaceHeader } from "./workspace-header";
import { useWorkspaceWidgets } from "./use-workspace-widgets";

export function Dashboard() {
  const [widgets, setWidgets] = useState(mockWidgets);
  const [tasks, setTasks] = useState(mockTasks);
  const router = useRouter();
  useEffect(() => { setWidgets(readPreviewWidgets()); }, []);
  const { state, retry } = useWorkspaceWidgets();
  const workspace = state.status === "ready" ? state.workspace : mockWorkspace;
  const displayedWidgets = state.status === "ready" ? state.widgets : widgets;
  async function createPreview(prompt: string) {
    const widget = await mockGenerateWidget(prompt);
    const updated = [...widgets, widget];
    sessionStorage.setItem("workspacezero.preview-widgets", JSON.stringify(updated));
    setWidgets(updated);
    router.push(`/widgets/${encodeURIComponent(widget.id)}?preview=1`);
  }
  function toggleTask(id: string) {
    if (workspace.role !== "admin") return;
    setTasks((current) => current.map((task) => task.id === id ? { ...task, status: task.status === "done" ? "todo" : "done" } : task));
  }
  return <div className="dashboard-shell"><a className="skip-link" href="#main">Skip to workspace</a><WorkspaceHeader workspace={workspace} />
    <main id="main" className="dashboard-main"><div className="workspace-intro"><div><p className="eyebrow"><span className="live-dot" />YOUR SHARED SPACE</p><h1>Less setup. More doing.</h1><p>Keep your team&apos;s tasks and little tools in one happy place.</p></div><div className="intro-tag"><Icon name="people" size={17} /><span>Small team. Big possibilities.</span></div></div>
      <div className="dashboard-grid"><div className="workspace-content"><div className="overview-grid"><Calendar /><TodoList tasks={tasks} canEdit={workspace.role === "admin"} onToggle={toggleTask} /></div><TaskBoard tasks={tasks} />
        <section className="section-block tools-section" aria-labelledby="tools-heading"><div className="section-heading"><div><h2 id="tools-heading">Team tools <span className="count-badge">{displayedWidgets.length}</span></h2><p>Small software, made for the way you work.</p></div>{workspace.role === "admin" && <a href="#tool-prompt" className="text-link"><Icon name="plus" size={15} />Create a tool</a>}</div>
          {state.status === "loading" && <p className="tools-data-note" role="status">Checking for saved tools. Showing sample content while loading.</p>}
          {state.status === "error" && <div className="tools-data-note"><span>{state.message} Showing sample content.</span><button type="button" onClick={retry}>Retry</button></div>}
          {displayedWidgets.length ? <nav className="tool-directory" aria-label="Open a team tool">{displayedWidgets.map((widget) => <Link key={widget.id} href={`/widgets/${encodeURIComponent(widget.id)}${state.status === "ready" ? "" : "?preview=1"}`}><Icon name="grid" size={17} /><span>{widget.title}</span><small>{state.status === "ready" ? "Open tool" : "Open preview"}</small><Icon name="arrow" size={15} /></Link>)}</nav> : <div className="empty-tools"><Icon name="sparkle" size={30} /><h3>Your next idea starts here.</h3><p>Describe a tool in the builder to give it a page of its own.</p></div>}
        </section>
      </div><AIBuilderPanel isAdmin={workspace.role === "admin"} onGenerate={createPreview} savedWorkspace={state.status === "ready"} /></div>
      <footer className="dashboard-footer"><span>WorkspaceZero · Small software. Shared workspace.</span><span>Phase 1 / Frontend preview</span></footer>
    </main>
  </div>;
}
