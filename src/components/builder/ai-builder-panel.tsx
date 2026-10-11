"use client";

import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { Icon } from "@/components/dashboard/icon";

const examples = ["Build a shared team poll", "Create a launch countdown", "Make a meeting cost calculator", "Create a personal scratchpad"];

export function AIBuilderPanel({ onGenerate, isAdmin, savedWorkspace = false }: { onGenerate: (prompt: string) => Promise<void>; isAdmin: boolean; savedWorkspace?: boolean }) {
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !isAdmin || savedWorkspace || !prompt.trim()) return;
    setBusy(true); setError(""); setMessage("");
    try {
      await onGenerate(prompt.trim());
      setMessage("Your tool's preview page is ready. Real generation connects in Phase 4."); setPrompt("");
    } catch { setError("We couldn't create the preview. Your prompt is still here—please try again."); }
    finally { setBusy(false); }
  }

  return <aside className="builder" aria-labelledby="builder-heading">
    <div className="builder-top"><span className="builder-icon"><Icon name="sparkle" size={23} /></span><span className="ai-label">YOUR IDEAS, MADE USEFUL</span></div>
    <h2 id="builder-heading">Build a team tool.</h2><p className="builder-description">Describe the tool your team needs.<br />We&apos;ll give it a place in your workspace.</p>
    {isAdmin ? <><form onSubmit={submit}><label htmlFor="tool-prompt" className="input-label">What would you like to create?</label>
      <textarea ref={inputRef} id="tool-prompt" placeholder="A poll to help our team decide what to work on next…" value={prompt} onChange={(event) => { setPrompt(event.target.value); setError(""); setMessage(""); }} maxLength={4000} required disabled={busy} rows={5} aria-describedby="builder-mode" />
      <div className="prompt-meta"><span>Make it as specific as you like</span><span>{prompt.length}/4000</span></div>
      <button type="submit" className="generate-button" disabled={savedWorkspace || busy || !prompt.trim()}>{busy ? <><span className="spinner" />Creating preview…</> : <><Icon name="sparkle" />{savedWorkspace ? "Generation coming in Phase 4" : "Create preview"}<Icon name="arrow" size={17} /></>}</button>
      <div aria-live="polite" aria-atomic="true">{error && <p className="feedback error" role="alert">{error}</p>}{message && <p className="feedback success">{message}</p>}</div>
    </form><div className="examples"><h3>Need a starting point?</h3>{examples.map((example) => <button key={example} type="button" disabled={busy} onClick={() => { setPrompt(example); setMessage(""); inputRef.current?.focus(); }}><Icon name="plus" size={14} />{example}<Icon name="arrow" size={14} /></button>)}</div></> : <p className="feedback">Your workspace admin can create new team tools.</p>}
    <div className="builder-note" id="builder-mode"><span className="note-dot" /><p><strong>Frontend preview</strong>Mock data for now. AI generation and saved tools connect in a later phase.</p></div>
  </aside>;
}
