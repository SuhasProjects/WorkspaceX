"use client";

import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { Widget, WidgetSize, WidgetSpan } from "@/types/contracts";
import type { WidgetTheme } from "@/lib/widget-protocol/protocol";
import { WidgetRenderer } from "./widget-renderer-adapter";
import { ToolManageBar } from "./tool-manage-bar";
import { ToolEditor } from "./tool-editor";

export const GRID_COLUMNS = 12;
export const ROW_UNIT = 32; // px; must match .widget-grid grid-auto-rows
const GRID_GAP = 18; // px; must match .widget-grid gap
const LIMITS = { minCols: 3, maxCols: 12, minRows: 4, maxRows: 40 };
const DEFAULT_SPAN: Record<WidgetSize, WidgetSpan> = { small: { cols: 4, rows: 11 }, medium: { cols: 8, rows: 14 }, large: { cols: 12, rows: 20 } };

interface WidgetGalleryProps {
  widgets: Widget[];
  workspaceId: string;
  theme: WidgetTheme;
  isAdmin: boolean;
  onDelete: (id: string) => Promise<string | null>;
  onSize: (id: string, size: WidgetSize) => Promise<string | null>;
  onSpan: (id: string, span: WidgetSpan) => Promise<string | null>;
  onUpdate: (widget: Widget) => void;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function WidgetGallery({ widgets, workspaceId, theme, isAdmin, onDelete, onSize, onSpan, onUpdate }: WidgetGalleryProps) {
  const [editingTool, setEditingTool] = useState<string | null>(null);
  // Live span while a card is being dragged; cleared once the server confirms.
  const [dragSpan, setDragSpan] = useState<{ id: string; span: WidgetSpan } | null>(null);
  const [spanError, setSpanError] = useState("");
  const gridRef = useRef<HTMLDivElement>(null);

  function spanOf(widget: Widget): WidgetSpan {
    if (dragSpan?.id === widget.id) return dragSpan.span;
    return widget.span ?? DEFAULT_SPAN[widget.size];
  }

  function startResize(widget: Widget, event: ReactPointerEvent<HTMLButtonElement>) {
    const grid = gridRef.current;
    if (!grid) return;
    event.preventDefault();
    const columnWidth = (grid.clientWidth - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS;
    const origin = spanOf(widget);
    const startX = event.clientX, startY = event.clientY;
    let latest = origin;
    const handle = event.currentTarget;
    handle.setPointerCapture(event.pointerId);
    const move = (moveEvent: PointerEvent) => {
      const cols = clamp(origin.cols + Math.round((moveEvent.clientX - startX) / (columnWidth + GRID_GAP)), LIMITS.minCols, LIMITS.maxCols);
      const rows = clamp(origin.rows + Math.round((moveEvent.clientY - startY) / (ROW_UNIT + GRID_GAP)), LIMITS.minRows, LIMITS.maxRows);
      if (cols !== latest.cols || rows !== latest.rows) { latest = { cols, rows }; setDragSpan({ id: widget.id, span: latest }); }
    };
    const finish = async () => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", finish);
      handle.removeEventListener("pointercancel", finish);
      if (latest.cols === origin.cols && latest.rows === origin.rows) { setDragSpan(null); return; }
      const message = await onSpan(widget.id, latest);
      setSpanError(message ?? "");
      setDragSpan(null);
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", finish);
    handle.addEventListener("pointercancel", finish);
  }

  return <section className="widget-gallery" aria-labelledby="widgets-heading">
    <div className="section-heading widget-gallery-heading"><div><p className="eyebrow"><span className="live-dot" />Workspace tools</p><h2 id="widgets-heading">Widgets <span className="count-badge">{widgets.length}</span></h2></div><span className="section-note">{isAdmin ? "Drag a corner to resize" : "Small and medium tools together"}</span></div>
    {spanError && <p className="feedback error" role="alert">{spanError}</p>}
    {widgets.length ? <div className="widget-grid" ref={gridRef}>{widgets.map((widget) => {
      const span = spanOf(widget);
      return <article className={`widget-card${dragSpan?.id === widget.id ? " is-resizing" : ""}`} key={widget.id} style={{ gridColumn: `span ${span.cols}`, gridRow: `span ${span.rows}` }}>
        <header className="widget-card-header"><div><span className="widget-size-badge">{span.cols}×{span.rows}</span><h3>{widget.title}</h3></div></header>
        {isAdmin && <ToolManageBar widget={widget} onDelete={onDelete} onSize={onSize} onDeleted={() => setEditingTool(null)} editing={editingTool === widget.id} onEdit={() => setEditingTool(editingTool === widget.id ? null : widget.id)} />}
        {isAdmin && editingTool === widget.id
          ? <ToolEditor key={widget.id} widget={widget} workspaceId={workspaceId} theme={theme} onClose={() => setEditingTool(null)} onSaved={(saved) => { onUpdate(saved); setEditingTool(null); }} />
          : <WidgetRenderer key={`${workspaceId}:${widget.id}:${widget.html.length}`} widgetId={widget.id} workspaceId={workspaceId} html={widget.html} theme={theme} title={widget.title} className="widget-card-frame" />}
        {isAdmin && <button type="button" className="widget-resize-handle" aria-label={`Resize ${widget.title}`} title="Drag to resize" onPointerDown={(event) => startResize(widget, event)} />}
      </article>;
    })}</div> : <div className="empty-tools"><h3>No compact widgets yet</h3><p>Small and medium widgets will appear together here.</p></div>}
  </section>;
}
