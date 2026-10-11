"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { ApiData, ApiResponse, Theme, Widget, Workspace } from "@/types/contracts";
import { mockWorkspace, readPreviewWidgets } from "./mock-data";

type WorkspaceState =
  | { status: "loading" }
  | { status: "ready"; workspace: Workspace; widgets: Widget[] }
  | { status: "error"; message: string };

async function request<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal, cache: "no-store", credentials: "same-origin" });
  if (response.status === 401) throw new Error("Sign in to your workspace to open its saved tools.");
  if (response.status === 403) throw new Error("Your session doesn't have access to these tools.");
  if (!response.ok) throw new Error("We couldn't load the workspace tools. Please try again.");
  const result: ApiResponse<T> = await response.json();
  if (result.error || !result.data) throw new Error("We couldn't load the workspace tools. Please try again.");
  return result.data;
}

// Both the dashboard and dedicated page load the same saved Widget records.
export function useWorkspaceWidgets(preview = false) {
  const previewWidgets = usePreviewWidgets();
  const [state, setState] = useState<WorkspaceState>({ status: "loading" });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (preview) {
      return;
    }
    const controller = new AbortController();
    Promise.all([
      request<ApiData["workspace"]>("/api/workspaces/current", controller.signal),
      request<ApiData["widgets"]>("/api/widgets", controller.signal),
    ]).then(([workspaceData, widgetData]) => {
      if (!workspaceData.workspace?.id || !Array.isArray(widgetData.widgets)) throw new Error("The workspace response isn't ready. Please try again.");
      if (!controller.signal.aborted) setState({ status: "ready", workspace: workspaceData.workspace, widgets: widgetData.widgets });
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setState({ status: "error", message: error instanceof Error ? error.message : "We couldn't load your tools." });
    });
    return () => controller.abort();
  }, [revision, preview]);
  function retry() { setState({ status: "loading" }); setRevision((value) => value + 1); }
  const resolvedState: WorkspaceState = preview ? { status: "ready", workspace: mockWorkspace, widgets: previewWidgets } : state;
  return { state: resolvedState, retry };
}

function previewSnapshot(): string | null {
  try { return sessionStorage.getItem("workspacezero.preview-widgets"); } catch { return null; }
}
function subscribePreview(callback: () => void) {
  window.addEventListener("workspacezero:preview", callback);
  window.addEventListener("storage", callback);
  return () => { window.removeEventListener("workspacezero:preview", callback); window.removeEventListener("storage", callback); };
}
export function usePreviewWidgets(): Widget[] {
  const snapshot = useSyncExternalStore(subscribePreview, previewSnapshot, () => null);
  return useMemo(() => readPreviewWidgets(snapshot), [snapshot]);
}
export function savePreviewWidgets(widgets: Widget[]) {
  sessionStorage.setItem("workspacezero.preview-widgets", JSON.stringify(widgets));
  window.dispatchEvent(new Event("workspacezero:preview"));
}

let fallbackTheme: Theme = "dark";
function readTheme(): Theme {
  try {
    const stored = localStorage.getItem("workspacezero.theme");
    return stored === "light" || stored === "dark" ? stored : fallbackTheme;
  } catch { return fallbackTheme; }
}
function subscribeTheme(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("workspacezero:theme", callback);
  return () => { window.removeEventListener("storage", callback); window.removeEventListener("workspacezero:theme", callback); };
}
export function setWidgetTheme(theme: Theme) {
  fallbackTheme = theme;
  try { localStorage.setItem("workspacezero.theme", theme); } catch { /* Retain this session's preference. */ }
  window.dispatchEvent(new Event("workspacezero:theme"));
}
export function useWidgetTheme(): Theme {
  return useSyncExternalStore(subscribeTheme, readTheme, () => "dark");
}
