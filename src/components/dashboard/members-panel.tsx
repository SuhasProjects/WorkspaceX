"use client";

import { useCallback, useEffect, useState } from "react";
import type { ApiData, ApiResponse, InvitationRole, Membership, Workspace, WorkspaceInvitation } from "@/types/contracts";
import { ROLE_LABEL, canManage, isOwner } from "@/lib/auth/roles";

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: "same-origin", cache: "no-store", ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  const result = (await response.json().catch(() => null)) as ApiResponse<T> | null;
  if (!response.ok || !result?.data) throw new Error(result?.error?.message ?? "The request failed.");
  return result.data;
}

export function MembersPanel({ workspace, currentUserId, onClose }: { workspace: Workspace; currentUserId: string; onClose: () => void }) {
  const [members, setMembers] = useState<Membership[]>([]);
  const [invitations, setInvitations] = useState<WorkspaceInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [username, setUsername] = useState("");
  const [role, setRole] = useState<InvitationRole>("member");
  const [busy, setBusy] = useState(false);
  const manage = canManage(workspace.role);
  const owner = isOwner(workspace.role);
  const teamPlan = workspace.plan === "team";

  const load = useCallback(async () => {
    try {
      const data = await call<ApiData["members"]>(`/api/workspaces/${encodeURIComponent(workspace.id)}/members`);
      setMembers(data.members); setInvitations(data.invitations); setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Members could not be loaded."); }
    finally { setLoading(false); }
  }, [workspace.id]);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  async function act(action: () => Promise<unknown>, success: string) {
    setBusy(true); setError(""); setNotice("");
    try { await action(); setNotice(success); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "The request failed."); }
    finally { setBusy(false); }
  }
  const base = `/api/workspaces/${encodeURIComponent(workspace.id)}`;

  return <section className="tool-pane members-panel" aria-labelledby="members-heading">
    <div className="widget-tools"><span className="widget-tools-label">Members</span><span className="widget-tools-confirm">{workspace.name}</span><button type="button" className="wz-tool-btn" onClick={onClose} style={{ marginLeft: "auto" }}>Close</button></div>
    <div className="members-body">
      <h2 id="members-heading">People in this workspace</h2>
      {loading ? <p className="widget-tools-confirm">Loading…</p> : <ul className="wz-list members-list">{members.map((member) => <li key={member.userId}>
        <span className="members-name"><strong>{member.username}</strong>{member.userId === currentUserId && <small> (you)</small>}</span>
        <span className="role-badge">{ROLE_LABEL[member.role]}</span>
        {owner && member.role !== "owner" && <span className="task-actions">
          <select value={member.role} disabled={busy} aria-label={`Role for ${member.username}`} onChange={(event) => act(() => call(`${base}/members/${encodeURIComponent(member.userId)}`, { method: "PATCH", body: JSON.stringify({ role: event.target.value }) }), `${member.username} is now ${event.target.value}.`)}>
            <option value="admin">Admin</option><option value="member">Member</option>
          </select>
          <button type="button" disabled={busy} onClick={() => act(() => call(`${base}/members/${encodeURIComponent(member.userId)}`, { method: "DELETE" }), `${member.username} was removed.`)}>Remove</button>
        </span>}
        {!owner && manage && member.role === "member" && <span className="task-actions"><button type="button" disabled={busy} onClick={() => act(() => call(`${base}/members/${encodeURIComponent(member.userId)}`, { method: "DELETE" }), `${member.username} was removed.`)}>Remove</button></span>}
      </li>)}</ul>}

      {manage && <>
        <h3>Invite someone</h3>
        {!teamPlan && <p className="widget-tools-confirm">Inviting members requires the workspace owner to be on the Team plan. <a href="/pricing" className="text-link">See plans</a>.</p>}
        <form className="members-invite" onSubmit={(event) => { event.preventDefault(); if (username.trim()) void act(() => call(`${base}/invitations`, { method: "POST", body: JSON.stringify({ username: username.trim(), role }) }).then(() => setUsername("")), `Invitation sent to ${username.trim()}.`); }}>
          <input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Existing username" maxLength={32} disabled={busy || !teamPlan} aria-label="Username to invite" />
          <select value={role} onChange={(event) => setRole(event.target.value as InvitationRole)} disabled={busy || !teamPlan} aria-label="Role"><option value="member">Member</option><option value="admin">Admin</option></select>
          <button type="submit" className="wz-tool-btn primary" disabled={busy || !teamPlan || !username.trim()}>Send invitation</button>
        </form>
        {invitations.length > 0 && <>
          <h3>Pending invitations</h3>
          <ul className="wz-list members-list">{invitations.map((invite) => <li key={invite.id}>
            <span className="members-name"><strong>{invite.invitedUsername ?? "user"}</strong><small> as {ROLE_LABEL[invite.role]} · expires {new Date(invite.expiresAt).toLocaleDateString()}</small></span>
            <span className="task-actions"><button type="button" disabled={busy} onClick={() => act(() => call(`${base}/invitations/${encodeURIComponent(invite.id)}`, { method: "DELETE" }), "Invitation revoked.")}>Revoke</button></span>
          </li>)}</ul>
        </>}
      </>}
      {notice && <p className="feedback success" role="status">{notice}</p>}
      {error && <p className="feedback error" role="alert">{error}</p>}
    </div>
  </section>;
}
