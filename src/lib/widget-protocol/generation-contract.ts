import { LIMITS } from "./protocol";
import { normalizeWidgetHtml } from "./build-document";
import type { WidgetSize } from "@/types/contracts";

/**
 * System prompt for the Luminal widget generator. Backend sends this as the
 * system message and the admin's request as the user message.
 */
export const WIDGET_SYSTEM_PROMPT = `You build small, self-contained web apps ("widgets") for WorkspaceZero, a shared team workspace.

OUTPUT FORMAT
- Reply with ONE complete HTML document and nothing else: no explanations, no Markdown fences.
- Start with <!DOCTYPE html>. Put a short human-friendly name (2-5 words) in <title>.
- In <head>, include exactly one size classification: <meta name="workspacezero:size" content="small">. Use only small, medium, or large.
- Choose small for a focused poll, counter, timer, single statistic, or quick action; medium for a list, tracker, chart, or multi-field form; large for a management system, complex dashboard, large table, or multi-step workflow.
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

LOOK AND FEEL (the widget must be indistinguishable from the host app's own panels)
The host is a dark-first, minimal workspace: thin display-font headings, small uppercase section labels, flat panels with 1px borders, outline buttons, no fills, no shadows, no emojis. Pre-styled building blocks are already available; build the UI from them:
- Page header:   <span class="wz-eyebrow">TEAM TOOL</span> <h1 class="wz-title">Name</h1> <p class="wz-subtitle">One line of purpose.</p>
- Panel/card:    <section class="wz-panel"> … </section>   (group related controls; stack panels with 16px gaps)
- Buttons:       <button class="wz-btn"> (default, outline) · <button class="wz-btn wz-btn-primary"> (the ONE main action) · <button class="wz-btn wz-btn-danger">
- Fields:        <label class="wz-label">Label</label> <input class="wz-input"> (inputs, selects, textareas are pre-styled)
- Layout:        <div class="wz-row"> for inline groups · <div class="wz-grid"> for responsive columns
- Numbers:       <div class="wz-stat"><span class="wz-eyebrow">Raised</span><div class="wz-stat-value">$500</div></div>
- Progress:      <div class="wz-bar"><span style="width:40%"></span></div>
- Lists:         <ul class="wz-list"><li>…</li></ul>
- Messages:      <p class="wz-status" id="status"></p>  (add class "error" for failures)
- Text helpers:  class="wz-muted" (secondary text), class="wz-small" (12px)
Rules:
- Colors: ONLY these variables, never hard-coded colors or gradients: --wz-background, --wz-surface, --wz-inset (input/stat backgrounds), --wz-hover, --wz-text, --wz-muted, --wz-border, --wz-accent, --wz-accent-text, --wz-danger, --wz-success.
- Fonts: never set font-family; body and headings are already correct. Headings h1/h2/h3 are pre-styled; do not change their weight.
- Corners: var(--wz-radius) everywhere. Borders: 1px solid var(--wz-border). No box-shadow, no gradients, no emojis, no icon fonts, no background images. Small inline SVG icons are fine.
- Fill the full page width. Do not wrap the widget in a centered max-width card. Do not set a page background or body padding.
- Keep your own <style> short: layout tweaks only (widths, gaps, alignment), not a new visual language.
- Text sizes: body 14px, secondary 12px, labels 10-12px uppercase via .wz-eyebrow. Spacing in multiples of 4px.
- The variables update automatically when the user switches light/dark theme.

STANDARD STRUCTURE (follow this shape so widgets are consistent and reliable)
- <head>: <title>, one <style> block.
- <body>: a root <main class="app"> with a heading, the main controls, and a status line for messages/errors.
- One <script> at the end of <body>, organized as:
    const KEYS = { ... };                    // storage keys used by this widget, defined once
    let state = { ... };                     // in-memory copy of data
    async function load() { ... }            // read storage (null → defaults), then render()
    function render() { ... }                // rebuild the UI from state; the ONLY place that touches the DOM
    async function act(...) { ... }          // user action: re-read shared data, change it, save, render()
    load();
- Use the root element width (width: 100%). Do not center the widget in a narrow column.
- Show a loading message until load() finishes, and an error message in the status line if storage fails.

QUALITY
- The widget must work immediately with no setup. Make it clean, modern, and usable.
- Never leave the user stuck: if a choice is remembered (for example a vote), always show a clear way to change it. Do not permanently disable controls.
- Selecting an option must give immediate visual feedback (highlight, checkmark, or count update) before and after saving.
- Attach event handlers with addEventListener or on* properties after the elements exist (place scripts at the end of <body>).
- Keep the document under 20 KB: no code comments, no blank-line padding, concise CSS. Spend the space on functionality, not filler.`;

/**
 * Appended to the system prompt when editing an existing widget. The current
 * document travels in the user message built by buildGenerationMessages.
 */
export const WIDGET_EDIT_INSTRUCTIONS = `
EDIT MODE
You are modifying an existing widget, not creating a new one.
- Apply only the requested change. Keep the layout, styling, wording, structure, and behavior of everything else exactly as it is.
- Keep every storage key the same so data already saved by the team keeps working. Add new keys only if the change needs new data.
- Keep the <title> unless the change is about the title.
- Keep the workspacezero:size metadata unless the requested change materially changes the widget's complexity; otherwise reclassify it using the same rules.
- Return the complete updated HTML document, following the same output format rules.`;

export interface GenerationMessage {
  role: "system" | "user";
  content: string;
}

export interface WidgetReference {
  title: string;
  html: string;
}

export interface GenerationInput {
  /** What the admin asked for: a new widget description, or a change request in edit mode. */
  prompt: string;
  /** Existing widget HTML. When present, the model edits it instead of starting over. */
  baseHtml?: string;
  /**
   * Recent widgets from the same workspace, used as look-and-feel examples.
   * Only their styles and markup skeleton are sent; scripts are stripped so
   * bugs and data keys are not copied. At most 2 are used.
   */
  references?: WidgetReference[];
}

const MAX_REFERENCES = 2;
const MAX_REFERENCE_CHARS = 2_500;

/** Reduces a widget to the parts that convey its appearance. */
export function summarizeReference({ title, html }: WidgetReference): string {
  const styles = Array.from(html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi), (m) => m[1].trim()).join("\n");
  const body = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? html;
  const markup = body
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<svg[\s\S]*?<\/svg>/gi, "<svg/>")
    .replace(/\s+/g, " ")
    .trim();
  const budget = Math.max(400, MAX_REFERENCE_CHARS - styles.length);
  return `Title: ${title}\nCSS:\n${styles.slice(0, 1_200)}\nMarkup:\n${markup.slice(0, budget)}`;
}

const REFERENCE_INSTRUCTIONS = `
REFERENCE WIDGETS
The examples below are existing tools in this workspace. Match their visual conventions (structure, spacing, use of the wz- classes and variables) so the new tool looks like it belongs with them. They are examples of appearance only: do not copy their features, text, or storage keys unless the request asks for them.`;

/** Builds the chat messages for Luminal. Backend passes these straight through. */
export function buildGenerationMessages({ prompt, baseHtml, references = [] }: GenerationInput): GenerationMessage[] {
  const request = prompt.trim();
  if (!baseHtml?.trim()) {
    const examples = references
      .filter((ref) => ref && typeof ref.html === "string" && ref.html.trim())
      .slice(0, MAX_REFERENCES)
      .map((ref, index) => `Example ${index + 1}:\n\`\`\`\n${summarizeReference(ref)}\n\`\`\``);
    const system = examples.length
      ? WIDGET_SYSTEM_PROMPT + "\n" + REFERENCE_INSTRUCTIONS + "\n\n" + examples.join("\n\n")
      : WIDGET_SYSTEM_PROMPT;
    return [
      { role: "system", content: system },
      { role: "user", content: request },
    ];
  }
  return [
    { role: "system", content: WIDGET_SYSTEM_PROMPT + "\n" + WIDGET_EDIT_INSTRUCTIONS },
    {
      role: "user",
      content:
        "CURRENT WIDGET:\n```html\n" + baseHtml.trim() + "\n```\n\nREQUESTED CHANGE:\n" + request,
    },
  ];
}

export interface ParsedWidget {
  title: string;
  html: string;
  size: WidgetSize;
}

export type ParseModelOutputResult =
  | { ok: true; widget: ParsedWidget; warnings: string[] }
  | { ok: false; error: string };

const FALLBACK_TITLE = "New widget";
const FALLBACK_SIZE: WidgetSize = "medium";

function readAttribute(tag: string, name: string): string | undefined {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return match?.[1] ?? match?.[2] ?? match?.[3];
}

function readWidgetSize(html: string): { size: WidgetSize; warning?: string } {
  const tag = (html.match(/<meta\b[^>]*>/gi) ?? []).find((candidate) => readAttribute(candidate, "name")?.toLowerCase() === "workspacezero:size");
  if (!tag) return { size: FALLBACK_SIZE, warning: "Missing widget size metadata; defaulted to medium." };
  const value = readAttribute(tag, "content")?.toLowerCase();
  if (value === "small" || value === "medium" || value === "large") return { size: value };
  return { size: FALLBACK_SIZE, warning: "Invalid widget size metadata; defaulted to medium." };
}

function decodeBasicEntities(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

function escapeTitle(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** A <script> that never closes means the reply ended mid-code. */
function isTruncated(html: string): boolean {
  const opens = (html.match(/<script\b/gi) ?? []).length;
  const closes = (html.match(/<\/script\s*>/gi) ?? []).length;
  return opens > closes;
}

/** Normalizes otherwise usable model fragments into the persisted full-document contract. */
function completeDocument(html: string, title: string): string {
  let content = html.replace(/^<!doctype\s+html\s*>/i, "").trim();
  if (!/<html[\s>]/i.test(content)) {
    return `<!DOCTYPE html><html><head><title>${escapeTitle(title)}</title></head><body>${content}</body></html>`;
  }
  if (!/<\/html\s*>\s*$/i.test(content)) content += "</html>";
  if (!/<head[\s>]/i.test(content)) {
    content = content.replace(/<html[^>]*>/i, `$&<head><title>${escapeTitle(title)}</title></head>`);
  }
  if (!/<body[\s>]/i.test(content)) {
    const start = content.search(/<\/head\s*>/i);
    const htmlEnd = content.search(/<\/html\s*>\s*$/i);
    const insertion = start >= 0 ? content.indexOf(">", start) + 1 : content.indexOf(">") + 1;
    content = `${content.slice(0, insertion)}<body>${content.slice(insertion, htmlEnd)}</body>${content.slice(htmlEnd)}`;
  }
  if (!/<\/body\s*>/i.test(content)) {
    const htmlEnd = content.search(/<\/html\s*>\s*$/i);
    content = `${content.slice(0, htmlEnd)}</body>${content.slice(htmlEnd)}`;
  }
  return `<!DOCTYPE html>${content}`;
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
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = decodeBasicEntities(titleMatch?.[1] ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
  const resolvedTitle = title || FALLBACK_TITLE;
  if (isTruncated(html)) {
    return { ok: false, error: "The model's reply was cut off before the widget was complete. Try again or ask for a simpler widget." };
  }
  html = completeDocument(html, resolvedTitle);
  if (new TextEncoder().encode(html).length > LIMITS.maxWidgetHtmlBytes) {
    return { ok: false, error: "The generated widget is too large." };
  }

  const classification = readWidgetSize(html);
  return {
    ok: true,
    widget: { title: resolvedTitle, html, size: classification.size },
    warnings: [...checkWidgetCompatibility(html), ...(classification.warning ? [classification.warning] : [])],
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
