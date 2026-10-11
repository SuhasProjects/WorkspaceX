"use client";

import type { Workspace } from "@/types/contracts";
import { Icon } from "./icon";
import { setWidgetTheme, useWidgetTheme } from "./use-workspace-widgets";

export function WorkspaceHeader({ workspace }: { workspace: Workspace }) {
  const theme = useWidgetTheme();
  return <header className="workspace-header"><div className="header-inner">
    <a href="#main" className="brand"><span className="brand-mark"><Icon name="grid" size={19} /></span>Workspace<span className="brand-zero">Zero</span></a>
    <span className="header-divider" /><span className="workspace-name">{workspace.name}<span className="preview-label">Preview</span></span>
    <div className="header-actions"><span className="role-badge">{workspace.role === "admin" ? "Admin" : "Member"}</span>
      <button type="button" className="icon-button theme-button" onClick={() => setWidgetTheme(theme === "dark" ? "light" : "dark")} aria-label={`Switch to ${theme === "dark" ? "Minimal Light" : "Obsidian Dark"}`} title={theme === "dark" ? "Switch to Minimal Light" : "Switch to Obsidian Dark"}><Icon name={theme === "dark" ? "sun" : "moon"} /></button>
      <button type="button" className="icon-button" disabled aria-label="Logout will be available when login is connected" title="Login is not connected in this preview"><Icon name="logout" /></button>
      <span className="avatar" aria-label="Launch team">LT</span></div>
  </div></header>;
}
