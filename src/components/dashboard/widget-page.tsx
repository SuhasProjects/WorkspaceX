"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { setAtmosphereAnimation, useAtmosphereAnimation, useWidgetTheme, useWorkspaceWidgets } from "./use-workspace-widgets";
import { WidgetRenderer } from "./widget-renderer-adapter";
import { Icon } from "./icon";
import { Atmosphere } from "./atmosphere";
import { ToolManageBar } from "./tool-manage-bar";
import type { WidgetSize } from "@/types/contracts";

export function WidgetPage({ widgetId, preview = false }: { widgetId: string; preview?: boolean }) {
  const { state, retry, removeWidget, duplicateWidget, updateWidgetSize } = useWorkspaceWidgets(preview);
  const router = useRouter();
  const isAdmin = state.status === "ready" && state.workspace.role === "admin" && !preview;
  const theme = useWidgetTheme();
  const animationEnabled = useAtmosphereAnimation();
  function toggleTheme() {
    try { localStorage.setItem("workspacezero.theme", theme === "dark" ? "light" : "dark"); } catch { /* optional */ }
    window.dispatchEvent(new Event("workspacezero:theme"));
  }
  const widgets = state.status === "ready" ? state.widgets : [];
  const largeWidgets = widgets.filter((item) => item.size === "large");
  const widget = widgets.find((item) => item.id === widgetId);
  const compactWidget = widget && widget.size !== "large" ? widget : null;
  async function changeSize(id: string, size: WidgetSize) {
    const message = await updateWidgetSize(id, size);
    if (!message && size !== "large") router.push("/?tool=widgets");
    return message;
  }

  return <div className="dashboard-shell min-h-screen" data-theme={theme}>
    <Atmosphere />
    <a className="skip-link" href="#widget-content">Skip to tool</a>
    <nav className="widget-page-nav" aria-label="Workspace tools"><Link href="/">← Dashboard</Link>{preview && <span className="preview-label">Mock preview</span>}<div className="widget-page-links"><Link href="/?tool=widgets">Widgets</Link>{largeWidgets.map((item) => <Link key={item.id} href={`/widgets/${encodeURIComponent(item.id)}${preview ? "?preview=1" : ""}`} aria-current={item.id === widgetId ? "page" : undefined}>{item.title}</Link>)}</div><button type="button" className="icon-button" aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`} onClick={toggleTheme}><Icon name="moon" /></button><button type="button" className="icon-button animation-toggle" aria-label={`Turn wave animation ${animationEnabled ? "off" : "on"}`} title={`Turn wave animation ${animationEnabled ? "off" : "on"}`} aria-pressed={animationEnabled} onClick={() => setAtmosphereAnimation(!animationEnabled)}><Icon name="waves" /></button></nav>
    {isAdmin && widget && <ToolManageBar widget={widget} onDelete={removeWidget} onDuplicate={duplicateWidget} onSize={changeSize} onDeleted={() => router.push("/")} />}
    <main id="widget-content">
      {state.status === "loading" && <div className="page-state h-[calc(100vh-64px)]" role="status"><span className="spinner" /><p>Loading workspace tools…</p></div>}
      {state.status === "signed_out" && <div className="page-state h-[calc(100vh-64px)]"><h1>Sign in required</h1><p>Open the dashboard and sign in to this workspace.</p><Link href="/" className="text-link">Go to sign in</Link></div>}
      {state.status === "error" && <div className="page-state h-[calc(100vh-64px)]" role="alert"><h1>Unable to open this tool</h1><p>{state.message}</p><button type="button" onClick={retry}>Try again</button></div>}
      {state.status === "ready" && !widget && <div className="page-state h-[calc(100vh-64px)]"><h1>{widgets.length ? "Tool not found" : "No saved tools yet"}</h1><p>{widgets.length ? "This tool may have been deleted. Choose another tool above or return to the dashboard." : "Return to the dashboard to create your first team tool."}</p><Link href="/" className="text-link">Back to dashboard</Link></div>}
      {state.status === "ready" && compactWidget && <div className="page-state h-[calc(100vh-64px)]"><h1>{compactWidget.title} is in Widgets</h1><p>Small and medium tools share one organized workspace page.</p><Link href="/?tool=widgets" className="text-link">Open Widgets</Link></div>}
      {state.status === "ready" && widget && !compactWidget && <WidgetRenderer key={`${state.workspace.id}:${widget.id}`} widgetId={widget.id} workspaceId={state.workspace.id} html={widget.html} theme={theme} preview={preview} className="h-[calc(100vh-64px)]" />}
    </main>
  </div>;
}
