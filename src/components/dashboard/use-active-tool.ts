"use client";

import { useSyncExternalStore } from "react";

const EVENT = "workspacezero:active-tool";

function readParam(): string | null {
  try { return new URLSearchParams(window.location.search).get("tool"); } catch { return null; }
}
function subscribe(callback: () => void) {
  window.addEventListener("popstate", callback);
  window.addEventListener(EVENT, callback);
  return () => { window.removeEventListener("popstate", callback); window.removeEventListener(EVENT, callback); };
}

/** Which tool tab is open on the dashboard, kept in the URL (?tool=id) so refresh and links work. */
export function useActiveTool(): string | null {
  return useSyncExternalStore(subscribe, readParam, () => null);
}

export function setActiveTool(id: string | null) {
  const url = new URL(window.location.href);
  if (id) url.searchParams.set("tool", id); else url.searchParams.delete("tool");
  window.history.pushState(null, "", url);
  window.dispatchEvent(new Event(EVENT));
}
