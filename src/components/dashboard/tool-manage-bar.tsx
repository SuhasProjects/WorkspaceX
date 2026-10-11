"use client";

import { useState } from "react";
import type { Widget } from "@/types/contracts";

interface ToolManageBarProps {
  widget: Widget;
  position: number;
  count: number;
  onMove: (id: string, delta: -1 | 1) => void;
  /** Resolves to an error message, or null on success. */
  onDelete: (id: string) => Promise<string | null>;
  onDeleted: () => void;
}

/** Admin controls shown above a tool: reorder its tab and delete it. */
export function ToolManageBar({ widget, position, count, onMove, onDelete, onDeleted }: ToolManageBarProps) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  async function remove() {
    const message = await onDelete(widget.id);
    if (message) { setError(message); setConfirming(false); return; }
    onDeleted();
  }
  return <div className="widget-tools" aria-label="Manage this tool">
    <span className="widget-tools-label">Manage tool</span>
    <button type="button" className="wz-tool-btn" disabled={position <= 0} onClick={() => onMove(widget.id, -1)}>← Move left</button>
    <button type="button" className="wz-tool-btn" disabled={position < 0 || position >= count - 1} onClick={() => onMove(widget.id, 1)}>Move right →</button>
    {confirming
      ? <><span className="widget-tools-confirm">Delete “{widget.title}” and its shared data?</span><button type="button" className="wz-tool-btn danger" onClick={remove}>Yes, delete</button><button type="button" className="wz-tool-btn" onClick={() => setConfirming(false)}>Cancel</button></>
      : <button type="button" className="wz-tool-btn danger" onClick={() => setConfirming(true)}>Delete tool</button>}
    {error && <span className="widget-tools-confirm" role="alert">{error}</span>}
  </div>;
}
