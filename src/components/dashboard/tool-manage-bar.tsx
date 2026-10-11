"use client";

import { useState } from "react";
import type { Widget } from "@/types/contracts";

interface ToolManageBarProps {
  widget: Widget;
  /** Resolves to an error message, or null on success. */
  onDelete: (id: string) => Promise<string | null>;
  onDeleted: () => void;
  /** When provided, shows an "Edit tool" button. */
  onEdit?: () => void;
  editing?: boolean;
}

/** Admin controls shown above a tool. Reordering is done by dragging the tabs. */
export function ToolManageBar({ widget, onDelete, onDeleted, onEdit, editing = false }: ToolManageBarProps) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  async function remove() {
    const message = await onDelete(widget.id);
    if (message) { setError(message); setConfirming(false); return; }
    onDeleted();
  }
  return <div className="widget-tools" aria-label="Manage this tool">
    <span className="widget-tools-label">Manage tool</span>
    {onEdit && <button type="button" className={`wz-tool-btn${editing ? " active" : ""}`} onClick={onEdit}>{editing ? "Close editor" : "Edit tool"}</button>}
    <span className="widget-tools-confirm">Drag the tabs above to reorder tools.</span>
    {confirming
      ? <><span className="widget-tools-confirm">Delete “{widget.title}” and its shared data?</span><button type="button" className="wz-tool-btn danger" onClick={remove}>Yes, delete</button><button type="button" className="wz-tool-btn" onClick={() => setConfirming(false)}>Cancel</button></>
      : <button type="button" className="wz-tool-btn danger" onClick={() => setConfirming(true)}>Delete tool</button>}
    {error && <span className="widget-tools-confirm" role="alert">{error}</span>}
  </div>;
}
