"use client";

import { useState } from "react";
import type { ApiResponse, GeneratedWidget, Theme, Widget } from "@/types/contracts";
import { WidgetRenderer } from "./widget-renderer-adapter";

interface ToolEditorProps {
  widget: Widget;
  workspaceId: string;
  theme: Theme;
  onSaved: (widget: Widget) => void;
  onClose: () => void;
}

async function send<T>(url: string, method: string, body: unknown): Promise<T> {
  const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify(body) });
  const result = (await response.json().catch(() => null)) as ApiResponse<T> | null;
  if (!response.ok || !result?.data) throw new Error(result?.error?.message ?? "The request failed. Please try again.");
  return result.data;
}

/** Describe a change, preview the regenerated tool, and save it over the original (same id and data). */
export function ToolEditor({ widget, workspaceId, theme, onSaved, onClose }: ToolEditorProps) {
  const [request, setRequest] = useState("");
  const [findText, setFindText] = useState("");
  const [replacementText, setReplacementText] = useState("");
  const [preview, setPreview] = useState<GeneratedWidget | null>(null);
  const [busy, setBusy] = useState<"generate" | "save" | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  function applyTextChange() {
    const source = preview?.html ?? widget.html;
    if (!findText) return;
    const matches = source.split(findText).length - 1;
    if (!matches) {
      setNotice("");
      setError(`“${findText}” was not found. Copy the text exactly as it appears in the widget.`);
      return;
    }
    const currentTitle = preview?.title ?? widget.title;
    setPreview({
      title: currentTitle === findText ? replacementText.trim() || currentTitle : currentTitle,
      html: source.split(findText).join(replacementText),
      size: preview?.size ?? widget.size,
    });
    setFindText("");
    setReplacementText("");
    setError("");
    setNotice(`${matches} text ${matches === 1 ? "match" : "matches"} updated. Review the preview, then save.`);
  }

  async function generate() {
    if (!request.trim() || busy) return;
    setBusy("generate"); setError(""); setNotice("");
    try {
      setPreview(await send<GeneratedWidget>("/api/generate", "POST", { prompt: request.trim(), baseHtml: preview?.html ?? widget.html }));
    } catch (err) { setError(err instanceof Error ? err.message : "Generation failed."); }
    finally { setBusy(null); }
  }
  async function save() {
    if (!preview || busy) return;
    setBusy("save"); setError("");
    try {
      const data = await send<{ widget: Widget }>(`/api/widgets/${encodeURIComponent(widget.id)}`, "PUT", {
        title: preview.title,
        html: preview.html,
      });
      onSaved(data.widget);
    } catch (err) { setError(err instanceof Error ? err.message : "Saving failed."); setBusy(null); }
  }

  return <div className="tool-editor">
    <div className="tool-editor-form">
      <div className="tool-editor-section">
        <div><strong>Edit text directly</strong><p>Enter wording exactly as it appears. Every exact match will be updated.</p></div>
        <div className="tool-text-fields">
          <label htmlFor={`tool-find-${widget.id}`}>Current text<input id={`tool-find-${widget.id}`} value={findText} onChange={(event) => setFindText(event.target.value)} disabled={busy !== null} placeholder="Weekly team poll" /></label>
          <label htmlFor={`tool-replace-${widget.id}`}>New text<input id={`tool-replace-${widget.id}`} value={replacementText} onChange={(event) => setReplacementText(event.target.value)} disabled={busy !== null} placeholder="October team poll" /></label>
        </div>
        <button type="button" className="wz-tool-btn" disabled={busy !== null || !findText} onClick={applyTextChange}>Apply text change</button>
      </div>
      <div className="tool-editor-divider"><span>or edit with AI</span></div>
      <label className="tool-editor-label" htmlFor={`tool-edit-request-${widget.id}`}>Describe a larger change to “{widget.title}”</label>
      <textarea id={`tool-edit-request-${widget.id}`} value={request} onChange={(event) => setRequest(event.target.value)} rows={3} maxLength={4000} disabled={busy !== null}
        placeholder="e.g. Add a monthly goal next to the total, and sort donations newest first" />
      <div className="tool-editor-actions">
        <button type="button" className="wz-tool-btn primary" disabled={busy !== null || !request.trim()} onClick={generate}>{busy === "generate" ? "Generating…" : preview ? "Regenerate with AI" : "Generate changes"}</button>
        {preview && <button type="button" className="wz-tool-btn primary" disabled={busy !== null} onClick={save}>{busy === "save" ? "Saving…" : "Save changes"}</button>}
        <button type="button" className="wz-tool-btn" disabled={busy === "save"} onClick={onClose}>{preview ? "Discard" : "Cancel"}</button>
        {error && <span className="widget-tools-confirm" role="alert">{error}</span>}
        {notice && !error && <span className="widget-tools-confirm" role="status">{notice}</span>}
      </div>
    </div>
    {preview && <>
      <p className="tool-editor-note">Preview of the updated tool. Try it, then save or discard.</p>
      <WidgetRenderer key={preview.html.length} widgetId={widget.id} workspaceId={workspaceId} html={preview.html} theme={theme} title={preview.title} preview className="tool-pane-frame" />
    </>}
  </div>;
}
