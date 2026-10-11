"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useWidgetTheme, useWorkspaceWidgets } from "./use-workspace-widgets";
import { WidgetRenderer } from "./widget-renderer-adapter";
import { Icon } from "./icon";
import { Atmosphere } from "./atmosphere";

export function WidgetPage({ widgetId, preview = false }: { widgetId: string; preview?: boolean }) {
  const { state, retry, moveWidget, removeWidget } = useWorkspaceWidgets(preview);
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [toolError, setToolError] = useState("");
  const isAdmin = state.status === "ready" && state.workspace.role === "admin" && !preview;
  const theme = useWidgetTheme();
  function toggleTheme() {
    try { localStorage.setItem("workspacezero.theme", theme === "dark" ? "light" : "dark"); } catch { /* optional */ }
    window.dispatchEvent(new Event("workspacezero:theme"));
  }
  const widgets = state.status === "ready" ? state.widgets : [];
  const widget = widgets.find((item) => item.id === widgetId);
  const position = widgets.findIndex((item) => item.id === widgetId);
  async function deleteCurrent() {
    const message = await removeWidget(widgetId);
    if (message) { setToolError(message); setConfirmDelete(false); return; }
    router.push("/");
  }

  return <div className="dashboard-shell min-h-screen" data-theme={theme}>
    <Atmosphere />
    <a className="skip-link" href="#widget-content">Skip to tool</a>
    <nav className="widget-page-nav" aria-label="Workspace tools"><Link href="/">← Dashboard</Link>{preview && <span className="preview-label">Mock preview</span>}<div className="widget-page-links">{widgets.map((item) => <Link key={item.id} href={`/widgets/${encodeURIComponent(item.id)}${preview ? "?preview=1" : ""}`} aria-current={item.id === widgetId ? "page" : undefined}>{item.title}</Link>)}</div><button type="button" className="icon-button" aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`} onClick={toggleTheme}><Icon name="moon" /></button></nav>
    {isAdmin && widget && <div className="widget-tools" aria-label="Manage this tool">
      <span className="widget-tools-label">Manage tool</span>
      <button type="button" className="wz-tool-btn" disabled={position <= 0} onClick={() => moveWidget(widgetId, -1)}>← Move left</button>
      <button type="button" className="wz-tool-btn" disabled={position < 0 || position >= widgets.length - 1} onClick={() => moveWidget(widgetId, 1)}>Move right →</button>
      {confirmDelete
        ? <><span className="widget-tools-confirm">Delete “{widget.title}” and its shared data?</span><button type="button" className="wz-tool-btn danger" onClick={deleteCurrent}>Yes, delete</button><button type="button" className="wz-tool-btn" onClick={() => setConfirmDelete(false)}>Cancel</button></>
        : <button type="button" className="wz-tool-btn danger" onClick={() => setConfirmDelete(true)}>Delete tool</button>}
      {toolError && <span className="widget-tools-confirm" role="alert">{toolError}</span>}
    </div>}
    <main id="widget-content">
      {state.status === "loading" && <div className="page-state h-[calc(100vh-64px)]" role="status"><span className="spinner" /><p>Loading workspace tools…</p></div>}
      {state.status === "signed_out" && <div className="page-state h-[calc(100vh-64px)]"><h1>Sign in required</h1><p>Open the dashboard and sign in to this workspace.</p><Link href="/" className="text-link">Go to sign in</Link></div>}
      {state.status === "error" && <div className="page-state h-[calc(100vh-64px)]" role="alert"><h1>Unable to open this tool</h1><p>{state.message}</p><button type="button" onClick={retry}>Try again</button></div>}
      {state.status === "ready" && !widget && <div className="page-state h-[calc(100vh-64px)]"><h1>{widgets.length ? "Tool not found" : "No saved tools yet"}</h1><p>{widgets.length ? "This tool may have been deleted. Choose another tool above or return to the dashboard." : "Return to the dashboard to create your first team tool."}</p><Link href="/" className="text-link">Back to dashboard</Link></div>}
      {state.status === "ready" && widget && <WidgetRenderer key={`${state.workspace.id}:${widget.id}`} widgetId={widget.id} workspaceId={state.workspace.id} html={widget.html} theme={theme} preview={preview} className="h-[calc(100vh-64px)]" />}
    </main>
  </div>;
}
