import type { Workspace } from "@/types/contracts";
import { Icon } from "./icon";
import { setAtmosphereAnimation, useAtmosphereAnimation } from "./use-workspace-widgets";

export function WorkspaceHeader({ workspace, theme, onTheme, onLogout }: {
  workspace: Workspace;
  theme: "light" | "dark";
  onTheme: () => void;
  onLogout: () => void;
}) {
  const animationEnabled = useAtmosphereAnimation();

  return <header className="workspace-header"><div className="header-inner">
    <div className="header-identity">
      <div className="brand"><span className="brand-mark"><Icon name="sparkle" size={20} /></span><span>Workspace<span className="brand-zero">Zero</span></span></div>
      <span className="header-divider" aria-hidden="true" />
      <span className="workspace-name" title={workspace.name}>{workspace.name}</span>
      <span className="role-badge">{workspace.role === "admin" ? "Admin" : "Member"}</span>
    </div>
    <div className="header-actions">
      <button type="button" className="icon-button theme-button" aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`} title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`} onClick={onTheme}><Icon name={theme === "dark" ? "sun" : "moon"} /></button>
      <button type="button" className="icon-button animation-toggle" aria-label={`Turn wave animation ${animationEnabled ? "off" : "on"}`} title={`Turn wave animation ${animationEnabled ? "off" : "on"}`} aria-pressed={animationEnabled} onClick={() => setAtmosphereAnimation(!animationEnabled)}><Icon name="waves" /></button>
      <button type="button" className="icon-button logout-button" aria-label="Log out" onClick={onLogout}><Icon name="logout" /></button>
      <span className="avatar" aria-hidden="true">WZ</span>
    </div>
  </div></header>;
}
