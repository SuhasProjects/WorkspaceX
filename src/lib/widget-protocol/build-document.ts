import { LIMITS, type WidgetTheme } from "./protocol";
import { buildRuntimeScript } from "./runtime";
import { themeCss } from "./theme";

/**
 * Network is blocked inside widgets. Widget code can only change the policy by
 * adding stricter rules, never looser ones, because every policy is enforced.
 */
export const WIDGET_CSP = [
  "default-src 'none'",
  "script-src 'unsafe-inline' 'unsafe-eval'",
  "style-src 'unsafe-inline'",
  "img-src data: blob:",
  "font-src data:",
  "media-src data: blob:",
  "connect-src 'none'",
  "form-action 'none'",
  "base-uri 'none'",
].join("; ");

const BASE_CSS = [
  ":where(html,body){margin:0}",
  ":where(body){background:var(--wz-background);color:var(--wz-text);padding:16px;box-sizing:border-box;",
  "font:14px/1.5 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif}",
  ":where(button){font:inherit;cursor:pointer;padding:6px 12px;border-radius:6px;",
  "border:1px solid var(--wz-border);background:var(--wz-accent);color:var(--wz-accent-text)}",
  ":where(input:not([type=radio]):not([type=checkbox]):not([type=range]):not([type=color]):not([type=file]),",
  "textarea,select){font:inherit;padding:6px 8px;border-radius:6px;",
  "border:1px solid var(--wz-border);background:var(--wz-surface);color:var(--wz-text)}",
].join("");

export type BuildResult = { ok: true; document: string } | { ok: false; error: string };

/** Strips Markdown code fences the model sometimes wraps around its output. */
export function normalizeWidgetHtml(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```[a-zA-Z]*\s*\n([\s\S]*?)\n?```$/);
  return (fenced ? fenced[1] : trimmed).trim();
}

/**
 * Produces the srcdoc for a widget. Our head is emitted first; the HTML parser
 * folds the generated document's own doctype/html/head tags into it, so both
 * full documents and bare fragments work.
 */
export function buildWidgetDocument(rawHtml: string, theme: WidgetTheme): BuildResult {
  if (typeof rawHtml !== "string") return { ok: false, error: "Widget HTML is missing." };
  const html = normalizeWidgetHtml(rawHtml);
  if (!html) return { ok: false, error: "Widget HTML is empty." };
  if (new TextEncoder().encode(html).length > LIMITS.maxWidgetHtmlBytes) {
    return { ok: false, error: "Widget HTML is too large to run." };
  }

  const head =
    `<!DOCTYPE html><html data-theme="${theme}"><head>` +
    `<meta http-equiv="Content-Security-Policy" content="${WIDGET_CSP}">` +
    `<meta name="referrer" content="no-referrer">` +
    `<meta name="viewport" content="width=device-width, initial-scale=1">` +
    `<style id="__wz_theme">${themeCss(theme)}</style>` +
    `<style id="__wz_base">${BASE_CSS}</style>` +
    `<script>${buildRuntimeScript(theme)}</script>`;

  return { ok: true, document: head + html };
}
