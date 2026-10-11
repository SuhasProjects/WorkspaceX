"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { ApiData, ApiResponse, Theme, Widget, WidgetSize, WidgetSpan, Workspace } from "@/types/contracts";
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

function moveId(ids: string[], draggedId: string, targetId: string): string[] | null {
  const next = ids.slice();
  const from = next.indexOf(draggedId), to = next.indexOf(targetId);
  if (from < 0 || to < 0) return null;
  next.splice(to, 0, next.splice(from, 1)[0]);
  return next;
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
      if (!controller.signal.aborted) {
        if (error instanceof RequestError && error.status === 401) setState({ status: "signed_out" });
        else setState({ status: "error", message: error instanceof Error ? error.message : "We couldn't load your tools." });
      }
    });
    return () => controller.abort();
  }, [revision, preview]);
  function retry() { setState({ status: "loading" }); setRevision((value) => value + 1); }
  /** Drops `draggedId` into `targetId`'s slot and saves the order for the whole team. */
  async function reorderWidget(draggedId: string, targetId: string): Promise<string | null> {
    if (state.status !== "ready" || draggedId === targetId) return null;
    const ids = moveId(state.widgets.map((widget) => widget.id), draggedId, targetId);
    if (!ids) return null;
    const previous = state;
    const byId = new Map(state.widgets.map((widget) => [widget.id, widget]));
    setState({ ...state, widgets: ids.map((id) => byId.get(id)!) });
    const response = await fetch("/api/widgets/order", {
      method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ ids }),
    });
    if (response.ok) return null;
    setState(previous);
    const result = (await response.json().catch(() => null)) as ApiResponse<unknown> | null;
    return result?.error?.message ?? "The new order could not be saved.";
  }
  /** Replaces a widget in local state after an edit is saved. */
  function updateWidget(updated: Widget) {
    if (state.status !== "ready") return;
    setState({ ...state, widgets: state.widgets.map((widget) => (widget.id === updated.id ? updated : widget)) });
  }
  /** Creates an independent copy of a widget without copying its shared storage. */
  async function duplicateWidget(id: string): Promise<string | null> {
    if (state.status !== "ready") return "Not ready.";
    const source = state.widgets.find((widget) => widget.id === id);
    if (!source) return "The tool could not be found.";
    const copySuffix = " copy";
    const title = `${source.title.slice(0, 120 - copySuffix.length).trimEnd()}${copySuffix}`;
    const response = await fetch("/api/widgets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ title, html: source.html, size: source.size }),
    });
    const result = (await response.json().catch(() => null)) as ApiResponse<{ widget: Widget }> | null;
    if (!response.ok || !result?.data) return result?.error?.message ?? "The tool could not be duplicated.";
    setState({ ...state, widgets: [...state.widgets, result.data.widget] });
    return null;
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
  /** Updates the persisted display size and immediately moves the widget between views. */
  async function patchWidget(id: string, body: { size?: WidgetSize; span?: WidgetSpan }): Promise<string | null> {
    if (state.status !== "ready") return "Not ready.";
    const response = await fetch(`/api/widgets/${encodeURIComponent(id)}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify(body),
    });
    const result = (await response.json().catch(() => null)) as ApiResponse<{ widget: Widget }> | null;
    if (!response.ok || !result?.data) return result?.error?.message ?? "The tool layout could not be updated.";
    setState({ ...state, widgets: state.widgets.map((widget) => widget.id === id ? result.data!.widget : widget) });
    return null;
  }
  function updateWidgetSize(id: string, size: WidgetSize) { return patchWidget(id, { size }); }
  /** Saves a drag-resized footprint for everyone in the workspace. */
  function updateWidgetSpan(id: string, span: WidgetSpan) { return patchWidget(id, { span }); }
  const resolvedState: WorkspaceState = preview ? { status: "ready", workspace: mockWorkspace, widgets: previewWidgets } : state;
  return { state: resolvedState, retry, reorderWidget, removeWidget, duplicateWidget, updateWidget, updateWidgetSize, updateWidgetSpan };
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

let fallbackAtmosphereAnimation = true;
function readAtmosphereAnimation(): boolean {
  try {
    const stored = localStorage.getItem("workspacezero.atmosphere-animation");
    return stored === null ? fallbackAtmosphereAnimation : stored === "on";
  } catch { return fallbackAtmosphereAnimation; }
}
function subscribeAtmosphereAnimation(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("workspacezero:atmosphere-animation", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("workspacezero:atmosphere-animation", callback);
  };
}
export function setAtmosphereAnimation(enabled: boolean) {
  fallbackAtmosphereAnimation = enabled;
  try { localStorage.setItem("workspacezero.atmosphere-animation", enabled ? "on" : "off"); } catch { /* Retain this session's preference. */ }
  window.dispatchEvent(new Event("workspacezero:atmosphere-animation"));
}
export function useAtmosphereAnimation(): boolean {
  return useSyncExternalStore(subscribeAtmosphereAnimation, readAtmosphereAnimation, () => true);
}
