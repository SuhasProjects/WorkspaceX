import { LIMITS } from "./protocol";
import { normalizeWidgetHtml } from "./build-document";

/**
 * System prompt for the Luminal widget generator. Backend sends this as the
 * system message and the admin's request as the user message.
 */
export const WIDGET_SYSTEM_PROMPT = `You build small, self-contained web apps ("widgets") for WorkspaceZero, a shared team workspace.

OUTPUT FORMAT
- Reply with ONE complete HTML document and nothing else: no explanations, no Markdown fences.
- Start with <!DOCTYPE html>. Put a short human-friendly name (2-5 words) in <title>.
- All CSS goes in <style> tags and all JavaScript in inline <script> tags in the same document.

WHERE THE WIDGET RUNS
- A sandboxed iframe inside a dashboard card, typically 300-600px wide. Make the layout responsive and fill the available width.
- There is NO network: fetch, XMLHttpRequest, WebSockets, external <script src>, external stylesheets, web fonts, and remote images are all blocked. Do not use CDNs or libraries. Write charts with plain SVG, canvas, or HTML/CSS.
- Do not use alert(), confirm(), prompt(), window.open(), or navigation (location changes, links that leave the page). Show messages inside the page instead.
- Prefer buttons with click handlers. If you use a <form>, handle its "submit" event and call event.preventDefault().
- Do not use localStorage, sessionStorage, IndexedDB, or cookies. Use the storage API below.
- Never ask for passwords, API keys, or other secrets.

STORAGE API (already available as the global object \`workspace\`; never define a variable named workspace)
- await workspace.getShared(key)            -> value shared with everyone in the workspace, or null if never saved
- await workspace.setShared(key, value)     -> save a shared value
- await workspace.getPersonal(key)          -> value private to the current user's browser, or null
- await workspace.setPersonal(key, value)   -> save a private value
Rules:
- Keys: 1-128 characters, only letters, digits, dot, underscore, hyphen. Example: "votes", "expenses.v1".
- Values must be JSON (objects, arrays, strings, numbers, booleans, null), at most 64 KB each.
- All four methods are asynchronous and can fail: use async/await with try/catch and show a friendly in-page message on error.
- Always treat a null result as "no data yet" and start from a sensible empty default.
- Use SHARED storage for anything the team should see together (votes, shared lists, totals, deadlines set for everyone).
- Use PERSONAL storage for individual preferences and private content (my notes, my filters, my display settings).
- After writing shared data, re-render from the value you saved. To reduce lost updates, read the latest value immediately before modifying and saving it.

THEME
- The page has CSS variables for the current light/dark theme. Use them instead of hard-coded colors:
  --wz-background, --wz-surface, --wz-text, --wz-muted, --wz-border, --wz-accent, --wz-accent-text, --wz-danger, --wz-success
- They update automatically when the user switches themes. Do not set your own page background color.

QUALITY
- The widget must work immediately with no setup. Make it clean, modern, and usable.
- Keep the whole document under 100 KB.`;

export interface ParsedWidget {
  title: string;
  html: string;
}

export type ParseModelOutputResult =
  | { ok: true; widget: ParsedWidget; warnings: string[] }
  | { ok: false; error: string };

const FALLBACK_TITLE = "New widget";

function decodeBasicEntities(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

/**
 * Turns raw model text into { title, html }. Tolerates prose or Markdown
 * fences around the document. Backend should still apply its own validation.
 */
export function parseModelOutput(raw: string): ParseModelOutputResult {
  if (typeof raw !== "string" || !raw.trim()) return { ok: false, error: "The model returned nothing." };

  let html = normalizeWidgetHtml(raw);
  const fenced = html.match(/```(?:html)?\s*\n([\s\S]*?)```/i);
  if (fenced) html = fenced[1].trim();
  const start = html.search(/<!DOCTYPE html|<html[\s>]/i);
  if (start > 0) html = html.slice(start);
  const end = html.toLowerCase().lastIndexOf("</html>");
  if (end >= 0) html = html.slice(0, end + "</html>".length);

  if (!/<(html|body|div|main|script)[\s>]/i.test(html)) {
    return { ok: false, error: "The model did not return an HTML document." };
  }
  if (new TextEncoder().encode(html).length > LIMITS.maxWidgetHtmlBytes) {
    return { ok: false, error: "The generated widget is too large." };
  }

  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = decodeBasicEntities(titleMatch?.[1] ?? "").replace(/\s+/g, " ").trim().slice(0, 80);

  return {
    ok: true,
    widget: { title: title || FALLBACK_TITLE, html },
    warnings: checkWidgetCompatibility(html),
  };
}

const COMPATIBILITY_CHECKS: [RegExp, string][] = [
  [/<script[^>]+\bsrc\s*=/i, "Loads an external script, which the sandbox blocks."],
  [/<link[^>]+rel\s*=\s*["']?stylesheet/i, "Loads an external stylesheet, which the sandbox blocks."],
  [/@import\s+url\(\s*["']?https?:/i, "Imports remote CSS (for example web fonts), which the sandbox blocks."],
  [/\b(fetch|XMLHttpRequest|WebSocket|EventSource)\s*\(/, "Makes network requests, which the sandbox blocks."],
  [/<(img|audio|video|source)[^>]+\bsrc\s*=\s*["']https?:/i, "References a remote image or media file, which the sandbox blocks."],
  [/\b(let|const|var)\s+workspace\b/, "Declares its own `workspace` variable, hiding the storage API."],
];

/** Non-fatal warnings about code that will not work inside the widget sandbox. */
export function checkWidgetCompatibility(html: string): string[] {
  return COMPATIBILITY_CHECKS.filter(([pattern]) => pattern.test(html)).map(([, message]) => message);
}
