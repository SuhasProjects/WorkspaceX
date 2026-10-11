import type { Workspace } from "@/types/contracts";
import { Icon } from "./icon";

export function WorkspaceHeader({ workspace }: { workspace: Workspace }) {
  return <header className="workspace-header"><div className="header-inner">
    <a href="#main" className="brand"><span className="brand-mark"><Icon name="grid" size={19} /></span>Workspace<span className="brand-zero">Zero</span></a>
    <span className="header-divider" /><span className="workspace-name">{workspace.name}<span className="preview-label">Preview</span></span>
    <div className="header-actions"><span className="role-badge">{workspace.role === "admin" ? "Admin" : "Member"}</span>
      <button type="button" className="icon-button" disabled aria-label="Theme switching is coming in Phase 2" title="Theme switching is coming in Phase 2"><Icon name="moon" /></button>
      <button type="button" className="icon-button" disabled aria-label="Logout will be available when login is connected" title="Login is not connected in this preview"><Icon name="logout" /></button>
      <span className="avatar" aria-label="Launch team">LT</span></div>
  </div></header>;
}
