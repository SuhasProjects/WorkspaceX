"use client";

import Link from "next/link";
import { useWidgetTheme, useWorkspaceWidgets } from "./use-workspace-widgets";
import { WidgetRenderer } from "./widget-renderer-adapter";

export function WidgetPage({ widgetId, preview = false }: { widgetId: string; preview?: boolean }) {
  const { state, retry } = useWorkspaceWidgets(preview);
  const theme = useWidgetTheme();
  const widgets = state.status === "ready" ? state.widgets : [];
  const widget = widgets.find((item) => item.id === widgetId);

  return <div className="min-h-screen" data-theme={theme}>
    <a className="skip-link" href="#widget-content">Skip to tool</a>
    <nav className="widget-page-nav" aria-label="Workspace tools"><Link href="/">← Dashboard</Link>{preview && <span className="preview-label">Mock preview</span>}<div className="widget-page-links">{widgets.map((item) => <Link key={item.id} href={`/widgets/${encodeURIComponent(item.id)}${preview ? "?preview=1" : ""}`} aria-current={item.id === widgetId ? "page" : undefined}>{item.title}</Link>)}</div></nav>
    <main id="widget-content">
      {state.status === "loading" && <div className="page-state h-[calc(100vh-64px)]" role="status"><span className="spinner" /><p>Loading workspace tools…</p></div>}
      {state.status === "error" && <div className="page-state h-[calc(100vh-64px)]" role="alert"><h1>Unable to open this tool</h1><p>{state.message}</p><button type="button" onClick={retry}>Try again</button></div>}
      {state.status === "ready" && !widget && <div className="page-state h-[calc(100vh-64px)]"><h1>{widgets.length ? "Tool not found" : "No saved tools yet"}</h1><p>{widgets.length ? "This tool may have been deleted. Choose another tool above or return to the dashboard." : "Return to the dashboard to create your first team tool."}</p><Link href="/" className="text-link">Back to dashboard</Link></div>}
      {state.status === "ready" && widget && <WidgetRenderer key={`${state.workspace.id}:${widget.id}`} widgetId={widget.id} workspaceId={state.workspace.id} html={widget.html} theme={theme} className="h-[calc(100vh-64px)]" />}
    </main>
  </div>;
}
