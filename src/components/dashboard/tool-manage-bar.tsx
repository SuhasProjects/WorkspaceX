"use client";

import { useState } from "react";
import type { Widget, WidgetSize } from "@/types/contracts";

interface ToolManageBarProps {
  widget: Widget;
  /** Resolves to an error message, or null on success. */
  onDelete: (id: string) => Promise<string | null>;
  onSize?: (id: string, size: WidgetSize) => Promise<string | null>;
  onDeleted: () => void;
  /** When provided, shows an "Edit tool" button. */
  onEdit?: () => void;
  editing?: boolean;
}

/** Admin controls shown above a tool. Reordering is done by dragging the tabs. */
export function ToolManageBar({ widget, onDelete, onSize, onDeleted, onEdit, editing = false }: ToolManageBarProps) {
  const [confirming, setConfirming] = useState(false);
  const [savingSize, setSavingSize] = useState(false);
  const [error, setError] = useState("");
  async function remove() {
    const message = await onDelete(widget.id);
    if (message) { setError(message); setConfirming(false); return; }
    onDeleted();
  }
  async function changeSize(size: WidgetSize) {
    if (!onSize) return;
    setSavingSize(true); setError("");
    const message = await onSize(widget.id, size);
    if (message) setError(message);
    setSavingSize(false);
  }
  return <div className="widget-tools" aria-label="Manage this tool">
    <span className="widget-tools-label">Manage tool</span>
    {onEdit && <button type="button" className={`wz-tool-btn${editing ? " active" : ""}`} onClick={onEdit}>{editing ? "Close editor" : "Edit tool"}</button>}
    {onSize && <label className="widget-size-control">Layout<select value={widget.size} disabled={savingSize} onChange={(event) => void changeSize(event.target.value as WidgetSize)} aria-label={`Layout size for ${widget.title}`}><option value="small">Small</option><option value="medium">Medium</option><option value="large">Large</option></select></label>}
    {confirming
      ? <><span className="widget-tools-confirm">Delete “{widget.title}” and its shared data?</span><button type="button" className="wz-tool-btn danger" onClick={remove}>Yes, delete</button><button type="button" className="wz-tool-btn" onClick={() => setConfirming(false)}>Cancel</button></>
      : <button type="button" className="wz-tool-btn danger" onClick={() => setConfirming(true)}>Delete tool</button>}
    {error && <span className="widget-tools-confirm" role="alert">{error}</span>}
  </div>;
}
