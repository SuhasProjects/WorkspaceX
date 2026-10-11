import type { Account, Workspace } from "@/types/contracts";
import { ROLE_LABEL } from "@/lib/auth/roles";
import { AccountMenu, type DashboardPanel } from "./account-menu";
import { Icon } from "./icon";
import { MusicToggle } from "./music-toggle";
import { setAtmosphereAnimation, useAtmosphereAnimation } from "./use-workspace-widgets";

export function WorkspaceHeader({ account, workspace, workspaces, invitationCount, theme, onTheme, onLogout, onSwitch, onCreate, onOpenPanel }: {
  account: Account;
  workspace: Workspace;
  workspaces: Workspace[];
  invitationCount: number;
  theme: "light" | "dark";
  onTheme: () => void;
  onLogout: () => void;
  onSwitch: (id: string) => Promise<string | null>;
  onCreate: (name: string) => Promise<string | null>;
  onOpenPanel: (panel: DashboardPanel) => void;
}) {
  const animationEnabled = useAtmosphereAnimation();

  return <header className="workspace-header"><div className="header-inner">
    <div className="header-identity">
      <div className="brand"><span className="brand-mark"><Icon name="sparkle" size={20} /></span><span>Workspace<span className="brand-zero">Zero</span></span></div>
      <span className="header-divider" aria-hidden="true" />
      <span className="workspace-name" title={workspace.name}>{workspace.name}</span>
      <span className="role-badge">{ROLE_LABEL[workspace.role]}</span>
    </div>
    <div className="header-actions">
      <button type="button" className="icon-button theme-button" aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`} title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`} onClick={onTheme}><Icon name={theme === "dark" ? "sun" : "moon"} /></button>
      <MusicToggle />
      <button type="button" className="icon-button animation-toggle" aria-label={`Turn wave animation ${animationEnabled ? "off" : "on"}`} title={`Turn wave animation ${animationEnabled ? "off" : "on"}`} aria-pressed={animationEnabled} onClick={() => setAtmosphereAnimation(!animationEnabled)}><Icon name="waves" /></button>
      <AccountMenu account={account} workspace={workspace} workspaces={workspaces} invitationCount={invitationCount} onSwitch={onSwitch} onCreate={onCreate} onOpenPanel={onOpenPanel} onLogout={onLogout} />
    </div>
  </div></header>;
}
