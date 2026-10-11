"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { ApiData, ApiResponse, Theme, Widget, Workspace } from "@/types/contracts";
import { mockWorkspace, readPreviewWidgets } from "./mock-data";

type WorkspaceState =
  | { status: "loading" }
  | { status: "signed_out" }
  | { status: "ready"; workspace: Workspace; widgets: Widget[] }
  | { status: "error"; message: string };

class RequestError extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}

async function request<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal, cache: "no-store", credentials: "same-origin" });
  if (response.status === 401) throw new RequestError(401, "Sign in to your workspace to open its saved tools.");
  if (response.status === 403) throw new RequestError(403, "Your session doesn't have access to these tools.");
  if (!response.ok) throw new Error("We couldn't load the workspace tools. Please try again.");
  const result: ApiResponse<T> = await response.json();
  if (result.error || !result.data) throw new Error("We couldn't load the workspace tools. Please try again.");
  return result.data;
}

// Tab order is kept per browser until the backend stores an order field.
function orderKey(workspaceId: string) { return `workspacezero.widget-order:${workspaceId}`; }
function readOrder(workspaceId: string): string[] {
  try { const raw = localStorage.getItem(orderKey(workspaceId)); const parsed: unknown = raw ? JSON.parse(raw) : []; return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : []; }
  catch { return []; }
}
function writeOrder(workspaceId: string, ids: string[]) {
  try { localStorage.setItem(orderKey(workspaceId), JSON.stringify(ids)); } catch { /* optional */ }
}
function applyOrder(widgets: Widget[], order: string[]): Widget[] {
  const rank = new Map(order.map((id, index) => [id, index]));
  return widgets.slice().sort((a, b) => (rank.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (rank.get(b.id) ?? Number.MAX_SAFE_INTEGER));
}

// Both the dashboard and dedicated page load the same saved Widget records.
export function useWorkspaceWidgets(preview = false) {
  const previewWidgets = usePreviewWidgets();
  const [state, setState] = useState<WorkspaceState>({ status: "loading" });
  const [revision, setRevision] = useState(0);
  const [orderVersion, setOrderVersion] = useState(0);
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
      if (!controller.signal.aborted) setState({ status: "ready", workspace: workspaceData.workspace, widgets: applyOrder(widgetData.widgets, readOrder(workspaceData.workspace.id)) });
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) {
        if (error instanceof RequestError && error.status === 401) setState({ status: "signed_out" });
        else setState({ status: "error", message: error instanceof Error ? error.message : "We couldn't load your tools." });
      }
    });
    return () => controller.abort();
  }, [revision, preview]);
  function retry() { setState({ status: "loading" }); setRevision((value) => value + 1); }
  /** Moves a widget one slot left (-1) or right (+1) in every tab list. */
  function moveWidget(id: string, delta: -1 | 1) {
    if (state.status !== "ready") return;
    const ids = state.widgets.map((widget) => widget.id);
    const from = ids.indexOf(id), to = from + delta;
    if (from < 0 || to < 0 || to >= ids.length) return;
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    writeOrder(state.workspace.id, ids);
    setState({ ...state, widgets: applyOrder(state.widgets, ids) });
    setOrderVersion((value) => value + 1);
  }
  /** Deletes a widget and its shared data (admin only; the server enforces this). */
  async function removeWidget(id: string): Promise<string | null> {
    if (state.status !== "ready") return "Not ready.";
    const response = await fetch(`/api/widgets/${encodeURIComponent(id)}`, { method: "DELETE", credentials: "same-origin" });
    if (!response.ok) {
      const result = (await response.json().catch(() => null)) as ApiResponse<unknown> | null;
      return result?.error?.message ?? "The tool could not be deleted.";
    }
    setState({ ...state, widgets: state.widgets.filter((widget) => widget.id !== id) });
    return null;
  }
  const resolvedState: WorkspaceState = preview ? { status: "ready", workspace: mockWorkspace, widgets: previewWidgets } : state;
  void orderVersion;
  return { state: resolvedState, retry, moveWidget, removeWidget };
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
