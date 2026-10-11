"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Account, Workspace } from "@/types/contracts";
import { ROLE_LABEL } from "@/lib/auth/roles";
import { planDefinition } from "@/lib/billing/plans";
import { Icon } from "./icon";

export type DashboardPanel = "members" | "invitations";

interface AccountMenuProps {
  account: Account;
  workspace: Workspace;
  workspaces: Workspace[];
  invitationCount: number;
  onSwitch: (id: string) => Promise<string | null>;
  onCreate: (name: string) => Promise<string | null>;
  onOpenPanel: (panel: DashboardPanel) => void;
  onLogout: () => void;
}

/** Header dropdown: who you are, which workspace you're in, and where else you can go. */
export function AccountMenu({ account, workspace, workspaces, invitationCount, onSwitch, onCreate, onOpenPanel, onLogout }: AccountMenuProps) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => { if (!ref.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const plan = planDefinition(account.plan);
  const owned = workspaces.filter((item) => item.ownerId === account.id).length;
  const atLimit = plan.workspaceLimit !== null && owned >= plan.workspaceLimit;

  async function run(action: () => Promise<string | null>) {
    setBusy(true); setError("");
    const message = await action();
    setBusy(false);
    if (message) setError(message); else { setOpen(false); setCreating(false); setName(""); }
  }

  return <div className="account-menu" ref={ref}>
    <button type="button" className="account-menu-trigger" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
      <span className="avatar" aria-hidden="true">{account.username.slice(0, 2).toUpperCase()}</span>
      <span className="account-menu-summary"><strong>{account.username}</strong><small>{workspace.name} · {ROLE_LABEL[workspace.role]}</small></span>
      {invitationCount > 0 && <span className="account-menu-badge" aria-label={`${invitationCount} pending invitations`}>{invitationCount}</span>}
      <Icon name="arrow" size={14} />
    </button>
    {open && <div className="account-menu-panel" role="menu">
      <div className="account-menu-section">
        <span className="eyebrow">Account</span>
        <p className="account-menu-line"><strong>{account.username}</strong><Link href="/pricing" className="plan-badge">{plan.name} plan</Link></p>
      </div>
      <div className="account-menu-section">
        <span className="eyebrow">Workspaces</span>
        <ul className="account-menu-list">
          {workspaces.map((item) => <li key={item.id}>
            <button type="button" role="menuitem" className={item.id === workspace.id ? "is-current" : undefined} disabled={busy || item.id === workspace.id} onClick={() => run(() => onSwitch(item.id))}>
              <span>{item.name}</span><small>{item.ownerId === account.id ? "Owner" : ROLE_LABEL[item.role]}</small>
            </button>
          </li>)}
        </ul>
        {creating
          ? <form className="account-menu-create" onSubmit={(event) => { event.preventDefault(); if (name.trim()) void run(() => onCreate(name.trim())); }}>
              <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Workspace name" maxLength={120} autoFocus disabled={busy} />
              <button type="submit" className="wz-tool-btn primary" disabled={busy || !name.trim()}>Create</button>
              <button type="button" className="wz-tool-btn" disabled={busy} onClick={() => { setCreating(false); setError(""); }}>Cancel</button>
            </form>
          : <button type="button" role="menuitem" className="account-menu-action" disabled={atLimit} title={atLimit ? `The ${plan.name} plan allows ${plan.workspaceLimit} owned workspace${plan.workspaceLimit === 1 ? "" : "s"}` : undefined} onClick={() => setCreating(true)}>
              <Icon name="plus" size={14} />Create workspace{atLimit && <small> · <Link href="/pricing">Upgrade for more</Link></small>}
            </button>}
      </div>
      <div className="account-menu-section">
        <button type="button" role="menuitem" className="account-menu-action" onClick={() => { setOpen(false); onOpenPanel("members"); }}><Icon name="people" size={14} />Members of {workspace.name}</button>
        <button type="button" role="menuitem" className="account-menu-action" onClick={() => { setOpen(false); onOpenPanel("invitations"); }}><Icon name="sparkle" size={14} />Invitations{invitationCount > 0 && <span className="account-menu-badge">{invitationCount}</span>}</button>
        <button type="button" role="menuitem" className="account-menu-action" onClick={onLogout}><Icon name="logout" size={14} />Log out</button>
      </div>
      {error && <p className="feedback error" role="alert">{error}</p>}
    </div>}
  </div>;
}
