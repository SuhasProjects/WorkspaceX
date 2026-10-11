"use client";

import { useState } from "react";
import type { FormEvent } from "react";

type Mode = "login" | "create";

export function WorkspaceAccess({ onSuccess }: { onSuccess: () => void }) {
  const [mode, setMode] = useState<Mode>("login");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError("");
    const data = new FormData(event.currentTarget);
    const body = mode === "login"
      ? { workspaceId: String(data.get("workspaceId") ?? "").trim().toLowerCase(), password: data.get("password") }
      : {
          name: data.get("name"),
          workspaceId: data.get("workspaceId") || undefined,
          adminPassword: data.get("adminPassword"),
          memberPassword: data.get("memberPassword"),
        };
    try {
      const response = await fetch(mode === "login" ? "/api/auth/login" : "/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error?.message ?? "Workspace access failed.");
      onSuccess();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Workspace access failed.");
    } finally { setBusy(false); }
  }

  return <main className="access-shell" data-theme="dark">
    <section className="access-card">
      <p className="eyebrow">WORKSPACEZERO</p>
      <h1>{mode === "login" ? "Open your workspace" : "Create a workspace"}</h1>
      <p>{mode === "login" ? "Enter the workspace ID shown in its header, not the workspace name." : "Set separate passwords for admins and members, then share the workspace ID with your team."}</p>
      <div className="access-tabs">
        <button type="button" aria-pressed={mode === "login"} onClick={() => { setMode("login"); setError(""); }}>Sign in</button>
        <button type="button" aria-pressed={mode === "create"} onClick={() => { setMode("create"); setError(""); }}>Create</button>
      </div>
      <form onSubmit={submit} className="access-form">
        {mode === "create" && <label>Workspace name<input name="name" required maxLength={120} autoComplete="organization" /></label>}
        <label>{mode === "login" ? "Workspace ID" : "Workspace ID (share this for sign-in)"}<input name="workspaceId" required={mode === "login"} minLength={3} maxLength={64} pattern="[a-z0-9-]+" placeholder={mode === "create" ? "Optional; generated if blank" : "launch-team"} autoCapitalize="none" autoCorrect="off" spellCheck={false} /></label>
        {mode === "login" ? <label>Password<input name="password" type="password" required autoComplete="current-password" /></label> : <>
          <label>Admin password<input name="adminPassword" type="password" required minLength={12} maxLength={128} autoComplete="new-password" /></label>
          <label>Member password<input name="memberPassword" type="password" required minLength={12} maxLength={128} autoComplete="new-password" /></label>
        </>}
        {error && <p className="feedback error" role="alert">{error}</p>}
        <button className="generate-button" disabled={busy}>{busy ? "Working…" : mode === "login" ? "Open workspace" : "Create workspace"}</button>
      </form>
    </section>
  </main>;
}
