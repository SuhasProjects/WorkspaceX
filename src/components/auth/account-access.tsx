"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { Atmosphere } from "@/components/dashboard/atmosphere";
import { prepareWorkspaceRevealSound, type WorkspaceRevealSound } from "./workspace-reveal";

type Mode = "login" | "signup";

/** Username/password sign-in and open signup. No email, no recovery flow yet. */
export function AccountAccess({ onSuccess }: { onSuccess: (sound: WorkspaceRevealSound | null) => void }) {
  const [mode, setMode] = useState<Mode>("login");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError("");
    const data = new FormData(event.currentTarget);
    const username = String(data.get("username") ?? "").trim();
    const password = String(data.get("password") ?? "");
    if (mode === "signup" && password !== String(data.get("confirm") ?? "")) {
      setBusy(false); setError("The two passwords don't match."); return;
    }
    const body = mode === "login"
      ? { username, password }
      : { username, password, workspaceName: String(data.get("workspaceName") ?? "").trim() };
    const revealSound = prepareWorkspaceRevealSound();
    try {
      const response = await fetch(mode === "login" ? "/api/auth/login" : "/api/auth/register", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify(body),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error?.message ?? "Sign-in failed.");
      onSuccess(revealSound);
    } catch (cause) {
      revealSound?.cancel();
      setError(cause instanceof Error ? cause.message : "Sign-in failed.");
    } finally { setBusy(false); }
  }

  return <div className="access-shell"><Atmosphere /><main className="access-card" aria-labelledby="access-heading">
    <p className="eyebrow">WorkspaceZero</p>
    <h1 id="access-heading">{mode === "login" ? "Welcome back" : "Create your account"}</h1>
    <p className="access-lede">{mode === "login" ? "Sign in with your username and password." : "Pick a username and password, and name your first workspace."}</p>
    <div className="access-tabs" role="tablist">
      <button type="button" role="tab" aria-selected={mode === "login"} onClick={() => { setMode("login"); setError(""); }}>Sign in</button>
      <button type="button" role="tab" aria-selected={mode === "signup"} onClick={() => { setMode("signup"); setError(""); }}>Sign up</button>
    </div>
    <form onSubmit={submit} className="access-form">
      <label><span>Username</span><input name="username" autoComplete="username" required minLength={3} maxLength={32} pattern="[A-Za-z0-9_-]+" placeholder="e.g. taylor" disabled={busy} /></label>
      <label><span>Password</span><input name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={12} maxLength={128} disabled={busy} /></label>
      {mode === "signup" && <>
        <label><span>Confirm password</span><input name="confirm" type="password" autoComplete="new-password" required minLength={12} maxLength={128} disabled={busy} /></label>
        <label><span>First workspace name</span><input name="workspaceName" required maxLength={120} placeholder="e.g. Launch team" disabled={busy} /></label>
        <p className="access-hint">Usernames are 3–32 letters, digits, underscores, or hyphens. Passwords are at least 12 characters.</p>
      </>}
      {error && <p className="feedback error" role="alert">{error}</p>}
      <button type="submit" className="generate-button" disabled={busy}>{busy ? "Working…" : mode === "login" ? "Sign in" : "Create account"}</button>
    </form>
    <p className="access-footnote">Password recovery is not available yet. Accounts have no email address, so keep your password somewhere safe.</p>
  </main></div>;
}
