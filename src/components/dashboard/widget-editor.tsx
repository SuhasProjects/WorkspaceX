"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import type { ApiResponse, GeneratedWidget, Theme, Widget } from "@/types/contracts";
import type { WidgetStatus } from "@/components/widget-engine/WidgetRenderer";
import { WidgetRenderer } from "./widget-renderer-adapter";

interface WidgetEditorProps {
  widget: Widget;
  workspaceId: string;
  theme: Theme;
  onCancel: () => void;
  onSaved: (widget: Widget) => void;
}

async function editRequest<T>(url: string, method: "POST" | "PUT", body: unknown, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, {
    method, credentials: "same-origin", signal,
    headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  if (response.status === 401) throw new Error("Your session has expired. Sign in again before editing.");
  if (response.status === 403) throw new Error("Only workspace admins can edit tools.");
  if (method === "PUT" && (response.status === 405 || response.status === 501)) {
    throw new Error("Saving edits isn't available yet. Your preview is kept here until the widget update API is connected.");
  }
  if (response.status === 404) throw new Error("The tool or editing endpoint is unavailable. Your original tool has not been replaced.");
  if (response.status === 413) throw new Error("This tool is too large to edit through the current API. Your original is unchanged.");
  if (response.status === 429) throw new Error("Too many requests. Wait a moment, then try again.");
  if (method === "POST" && response.status === 400) throw new Error("The generation API couldn't accept this edit. It needs to support prompt and baseHtml.");
  if (!response.ok) throw new Error(method === "PUT" ? "We couldn't save the edit. Your preview is still here; please try again." : "We couldn't generate the change. Your original tool is unchanged; please try again.");
  const result: ApiResponse<T> = await response.json().catch(() => { throw new Error("The editing API returned an unreadable response. Your preview has not been approved."); });
  if (!result.data) throw new Error("The editing API returned an unexpected response. Please try again.");
  return result.data;
}

export function WidgetEditor({ widget, workspaceId, theme, onCancel, onSaved }: WidgetEditorProps) {
  const [prompt, setPrompt] = useState("");
  const [draft, setDraft] = useState<GeneratedWidget | null>(null);
  const [busy, setBusy] = useState<"generate" | "save" | null>(null);
  const [error, setError] = useState("");
  const [previewStatus, setPreviewStatus] = useState<WidgetStatus>("loading");
  const [runtimeError, setRuntimeError] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const promptRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { promptRef.current?.focus(); return () => controller.current?.abort(); }, []);

  async function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !prompt.trim()) return;
    const request = new AbortController();
    controller.current = request;
    setBusy("generate"); setError(""); setDraft(null); setRuntimeError(false); setPreviewStatus("loading");
    try {
      const result = await editRequest<GeneratedWidget>("/api/generate", "POST", { prompt: prompt.trim(), baseHtml: widget.html }, request.signal);
      if (typeof result.html !== "string" || !result.html.trim() || typeof result.title !== "string" || !result.title.trim()) throw new Error("The generated edit is incomplete. Please try again.");
      if (!request.signal.aborted) setDraft(result);
    } catch (cause) {
      if (!request.signal.aborted) setError(cause instanceof Error ? cause.message : "We couldn't generate the edit.");
    } finally { if (!request.signal.aborted) setBusy(null); }
  }

  async function save() {
    if (!draft || busy || previewStatus !== "ready" || runtimeError) return;
    const request = new AbortController();
    controller.current = request;
    setBusy("save"); setError("");
    try {
      const result = await editRequest<{ widget: Widget }>(`/api/widgets/${encodeURIComponent(widget.id)}`, "PUT", draft, request.signal);
      if (!result.widget || result.widget.id !== widget.id || typeof result.widget.html !== "string" || typeof result.widget.title !== "string") throw new Error("The update API didn't return the same tool. Refresh the page to check its saved state.");
      if (!request.signal.aborted) onSaved(result.widget);
    } catch (cause) {
      if (!request.signal.aborted) setError(cause instanceof Error ? cause.message : "We couldn't save the edit.");
    } finally { if (!request.signal.aborted) setBusy(null); }
  }

  return <section className="widget-edit" aria-labelledby="edit-heading" aria-busy={busy !== null}>
    <div className="widget-edit-heading"><div><h1 id="edit-heading">Edit {widget.title}</h1><p>Describe the change, review the preview, then approve it. The saved tool stays unchanged until you save.</p></div>
      <button type="button" disabled={busy === "save"} onClick={() => { controller.current?.abort(); onCancel(); }}>Cancel edit</button></div>
    <form onSubmit={generate} className="widget-edit-form"><label htmlFor="edit-prompt">What should change?</label>
      <textarea ref={promptRef} id="edit-prompt" value={prompt} maxLength={4000} required rows={3} disabled={busy !== null} placeholder="For example: add a results summary below the poll." onChange={(event) => { setPrompt(event.target.value); setDraft(null); setError(""); }} />
      <button type="submit" disabled={busy !== null || !prompt.trim()}>{busy === "generate" ? "Generating edit…" : "Preview change"}</button></form>
    <div aria-live="polite" aria-atomic="true">{error && <p className="feedback error" role="alert">{error}</p>}{busy === "generate" && <p className="widget-edit-note">Generating a preview. Your saved tool is unchanged.</p>}</div>
    {draft && <section className="widget-edit-review" aria-labelledby="review-heading"><div className="widget-edit-heading"><div><h2 id="review-heading">Review: {draft.title}</h2><p>Unsaved preview. Changes here do not affect the team&apos;s saved data.</p></div>
      <button type="button" className="widget-edit-save" onClick={() => void save()} disabled={busy !== null || previewStatus !== "ready" || runtimeError}>{busy === "save" ? "Saving…" : "Approve and replace tool"}</button></div>
      {runtimeError && <p className="feedback error" role="alert">The preview encountered an error. Generate a corrected edit before saving.</p>}
      <WidgetRenderer key={draft.html} widgetId={`edit-preview-${widget.id}`} workspaceId={workspaceId} html={draft.html} title={`Edit preview: ${draft.title}`} theme={theme} preview className="widget-edit-frame" onStatusChange={setPreviewStatus} onRuntimeError={() => setRuntimeError(true)} />
    </section>}
  </section>;
}
