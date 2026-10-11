"use client";

import { useCallback, useEffect, useState } from "react";
import type { ApiData, ApiResponse, WorkspaceInvitation } from "@/types/contracts";
import { ROLE_LABEL } from "@/lib/auth/roles";

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: "same-origin", cache: "no-store", ...init });
  const result = (await response.json().catch(() => null)) as ApiResponse<T> | null;
  if (!response.ok || !result?.data) throw new Error(result?.error?.message ?? "The request failed.");
  return result.data;
}

/** Pending invitations for the signed-in user. Accepting does not switch workspaces unless asked. */
export function InvitationsPanel({ onClose, onChanged, onOpenWorkspace }: { onClose: () => void; onChanged: () => void; onOpenWorkspace: (id: string) => void }) {
  const [invitations, setInvitations] = useState<WorkspaceInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [accepted, setAccepted] = useState<{ id: string; name: string } | null>(null);

  const load = useCallback(async () => {
    try { setInvitations((await call<ApiData["invitations"]>("/api/invitations")).invitations); setError(""); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Invitations could not be loaded."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  async function respond(invite: WorkspaceInvitation, action: "accept" | "decline") {
    setBusy(invite.id); setError("");
    try {
      await call(`/api/invitations/${encodeURIComponent(invite.id)}/${action}`, { method: "POST" });
      if (action === "accept") setAccepted({ id: invite.workspace.id, name: invite.workspace.name });
      onChanged();
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The request failed."); }
    finally { setBusy(null); }
  }

  return <section className="tool-pane members-panel" aria-labelledby="invitations-heading">
    <div className="widget-tools"><span className="widget-tools-label">Invitations</span><button type="button" className="wz-tool-btn" onClick={onClose} style={{ marginLeft: "auto" }}>Close</button></div>
    <div className="members-body">
      <h2 id="invitations-heading">Pending invitations</h2>
      {loading ? <p className="widget-tools-confirm">Loading…</p> : invitations.length === 0 ? <p className="widget-tools-confirm">No pending invitations.</p>
        : <ul className="wz-list members-list">{invitations.map((invite) => <li key={invite.id}>
          <span className="members-name"><strong>{invite.workspace.name}</strong><small> · invited by {invite.invitedBy.username} as {ROLE_LABEL[invite.role]} · expires {new Date(invite.expiresAt).toLocaleDateString()}</small></span>
          <span className="task-actions">
            <button type="button" className="wz-tool-btn primary" disabled={busy !== null} onClick={() => respond(invite, "accept")}>{busy === invite.id ? "Working…" : "Accept"}</button>
            <button type="button" className="wz-tool-btn" disabled={busy !== null} onClick={() => respond(invite, "decline")}>Decline</button>
          </span>
        </li>)}</ul>}
      {accepted && <p className="feedback success" role="status">You joined {accepted.name}. <button type="button" className="text-link" onClick={() => onOpenWorkspace(accepted.id)}>Open it</button></p>}
      {error && <p className="feedback error" role="alert">{error}</p>}
    </div>
  </section>;
}
