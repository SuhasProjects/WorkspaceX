"use client";

import { useState } from "react";
import type { Widget, WidgetSize } from "@/types/contracts";
import type { WidgetTheme } from "@/lib/widget-protocol/protocol";
import { WidgetRenderer } from "./widget-renderer-adapter";
import { ToolManageBar } from "./tool-manage-bar";
import { ToolEditor } from "./tool-editor";

interface WidgetGalleryProps {
  widgets: Widget[];
  workspaceId: string;
  theme: WidgetTheme;
  isAdmin: boolean;
  onDelete: (id: string) => Promise<string | null>;
  onSize: (id: string, size: WidgetSize) => Promise<string | null>;
  onUpdate: (widget: Widget) => void;
}

export function WidgetGallery({ widgets, workspaceId, theme, isAdmin, onDelete, onSize, onUpdate }: WidgetGalleryProps) {
  const [editingTool, setEditingTool] = useState<string | null>(null);
  return <section className="widget-gallery" aria-labelledby="widgets-heading">
    <div className="section-heading widget-gallery-heading"><div><p className="eyebrow"><span className="live-dot" />Workspace tools</p><h2 id="widgets-heading">Widgets <span className="count-badge">{widgets.length}</span></h2></div><span className="section-note">Small and medium tools together</span></div>
    {widgets.length ? <div className="widget-grid">{widgets.map((widget) => <article className={`widget-card widget-card-${widget.size}`} key={widget.id}>
      <header className="widget-card-header"><div><span className="widget-size-badge">{widget.size}</span><h3>{widget.title}</h3></div></header>
      {isAdmin && <ToolManageBar widget={widget} onDelete={onDelete} onSize={onSize} onDeleted={() => setEditingTool(null)} editing={editingTool === widget.id} onEdit={() => setEditingTool(editingTool === widget.id ? null : widget.id)} />}
      {isAdmin && editingTool === widget.id
        ? <ToolEditor key={widget.id} widget={widget} workspaceId={workspaceId} theme={theme} onClose={() => setEditingTool(null)} onSaved={(saved) => { onUpdate(saved); setEditingTool(null); }} />
        : <WidgetRenderer key={`${workspaceId}:${widget.id}:${widget.html.length}`} widgetId={widget.id} workspaceId={workspaceId} html={widget.html} theme={theme} title={widget.title} className="widget-card-frame" />}
    </article>)}</div> : <div className="empty-tools"><h3>No compact widgets yet</h3><p>Small and medium widgets will appear together here.</p></div>}
  </section>;
}
