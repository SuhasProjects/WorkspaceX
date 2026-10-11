"use client";

import { useEffect, useState } from "react";
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

// Both the dashboard and dedicated page load the same saved Widget records.
export function useWorkspaceWidgets(preview = false) {
  const [state, setState] = useState<WorkspaceState>({ status: "loading" });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (preview) {
      setState({ status: "ready", workspace: mockWorkspace, widgets: readPreviewWidgets() });
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
  return { state, retry };
}

export function useWidgetTheme(): Theme {
  const [theme, setTheme] = useState<Theme>("light");
  useEffect(() => {
    function readTheme() {
      try { setTheme(localStorage.getItem("workspacezero.theme") === "dark" ? "dark" : "light"); }
      catch { /* Browser storage is optional; keep the default. */ }
    }
    readTheme();
    window.addEventListener("storage", readTheme);
    window.addEventListener("workspacezero:theme", readTheme);
    return () => { window.removeEventListener("storage", readTheme); window.removeEventListener("workspacezero:theme", readTheme); };
  }, []);
  return theme;
}
