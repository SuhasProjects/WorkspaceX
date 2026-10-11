"use client";

import type { Workspace } from "@/types/contracts";
import { Icon } from "./icon";

export function WorkspaceHeader({ workspace, theme, onTheme, onLogout }: {
  workspace: Workspace;
  theme: "light" | "dark";
  onTheme: () => void;
  onLogout: () => void;
}) {
  return <header className="workspace-header"><div className="header-inner">
    <div className="brand"><span className="brand-mark"><Icon name="sparkle" size={20} /></span><span>Workspace<span>Zero</span></span></div>
    <span className="header-divider" /><span className="workspace-name">{workspace.name}<small>Workspace ID: {workspace.id}</small></span>
    <div className="header-actions"><span className="role-badge">{workspace.role === "admin" ? "Admin" : "Member"}</span>
      <button type="button" className="icon-button theme-button" aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`} title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`} onClick={onTheme}><Icon name={theme === "dark" ? "sun" : "moon"} /></button>
      <button type="button" className="icon-button logout-button" aria-label="Log out" onClick={onLogout}><Icon name="logout" /></button>
      <span className="avatar" aria-hidden="true">WZ</span>
    </div>
  </div></header>;
}
