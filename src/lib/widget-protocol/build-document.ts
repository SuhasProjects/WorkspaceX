import { LIMITS, type WidgetTheme } from "./protocol";
import { buildRuntimeScript } from "./runtime";
import { themeCss, type ThemeTokens } from "./theme";

/**
 * Network is blocked inside widgets. Widget code can only change the policy by
 * adding stricter rules, never looser ones, because every policy is enforced.
 */
export function widgetCsp(fontOrigin?: string): string {
  const fontSources = ["data:"];
  if (fontOrigin && /^https?:\/\/[^\s/]+$/.test(fontOrigin)) fontSources.push(fontOrigin);
  return [
    "default-src 'none'",
    "script-src 'unsafe-inline' 'unsafe-eval'",
    "style-src 'unsafe-inline'",
    "img-src data: blob:",
    `font-src ${fontSources.join(" ")}`,
    "media-src data: blob:",
    "connect-src 'none'",
    "form-action 'none'",
    "base-uri 'none'",
  ].join("; ");
}

export const WIDGET_CSP = widgetCsp();

const BASE_CSS = [
  // Saved widgets may reset body padding; keep the host inset consistent.
  "html body{padding:24px 28px!important;box-sizing:border-box!important}",
  "@media(max-width:480px){html body{padding:20px!important}}",
  "html[data-theme=light] body{color:var(--wz-muted)!important}",
  "html[data-theme=light] :where(h1,h2,h3,h4,h5,h6,p,label,button:not(.wz-btn-primary):not(.wz-btn-danger)){color:var(--wz-muted)!important}",
  // Transparent page: the dashboard's own background shows through the frame.
  ":where(html,body){margin:0;background:transparent}",
  ":where(body){color:var(--wz-text);padding:24px 28px;box-sizing:border-box;",
  "font:14px/1.55 var(--wz-font);-webkit-font-smoothing:antialiased}",
  ":where(h1,h2,h3){font-family:var(--wz-font-display);font-weight:var(--wz-heading-weight);",
  "letter-spacing:var(--wz-heading-spacing);margin:0 0 8px;line-height:1.15}",
  ":where(h1){font-size:34px}:where(h2){font-size:22px}:where(h3){font-size:16px}",
  ":where(p){margin:0 0 8px}",
  ":where(button){font:inherit;font-size:13px;cursor:pointer;padding:9px 16px;border-radius:var(--wz-radius);",
  "border:1px solid var(--wz-border);background:transparent;color:var(--wz-text);transition:background .15s,border-color .15s}",
  ":where(button:hover:not(:disabled)){background:var(--wz-hover)}",
  ":where(button:disabled){opacity:.5;cursor:default}",
  ":where(input:not([type=radio]):not([type=checkbox]):not([type=range]):not([type=color]):not([type=file]),",
  "textarea,select){font:inherit;padding:10px 12px;border-radius:var(--wz-radius);box-sizing:border-box;",
  "border:1px solid var(--wz-border);background:var(--wz-inset);color:var(--wz-text);outline:none}",
  ":where(input,textarea,select):focus{border-color:var(--wz-accent)}",
  ":where(input,textarea)::placeholder{color:var(--wz-muted);opacity:.85}",
  ":where(table){border-collapse:collapse;width:100%}",
  ":where(th,td){text-align:left;padding:9px 10px;border-bottom:1px solid var(--wz-border)}",
  ":where(th){font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--wz-muted);font-weight:500}",
  ":where(hr){border:0;border-top:1px solid var(--wz-border);margin:16px 0}",
  // Host-matched building blocks the generation prompt tells the model to use.
  ".wz-panel{background:var(--wz-glass);border:1px solid var(--wz-border);border-radius:var(--wz-radius);padding:22px 24px;",
  "backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);margin-bottom:16px}",
  ".wz-eyebrow{display:block;font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--wz-muted);font-weight:500;margin-bottom:10px}",
  ".wz-title{font-family:var(--wz-font-display);font-weight:var(--wz-heading-weight);letter-spacing:var(--wz-heading-spacing);font-size:36px;line-height:1.1;margin:0 0 8px}",
  ".wz-subtitle{color:var(--wz-muted);font-size:14px;margin:0 0 22px}",
  ".wz-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;font:inherit;font-size:13px;letter-spacing:.02em;",
  "padding:10px 18px;border-radius:var(--wz-radius);border:1px solid var(--wz-border);background:transparent;color:var(--wz-text);cursor:pointer}",
  ".wz-btn:hover:not(:disabled){background:var(--wz-hover)}",
  ".wz-btn-primary{background:var(--wz-accent);color:var(--wz-accent-text);border-color:var(--wz-accent)}",
  ".wz-btn-primary:hover:not(:disabled){filter:brightness(1.06);background:var(--wz-accent)}",
  ".wz-btn-danger{color:var(--wz-danger);border-color:var(--wz-danger)}",
  ".wz-input{width:100%}",
  ".wz-label{display:block;font-size:12px;color:var(--wz-muted);margin-bottom:6px}",
  ".wz-row{display:flex;gap:12px;align-items:center;flex-wrap:wrap}",
  ".wz-grid{display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(200px,1fr))}",
  ".wz-stat{background:var(--wz-inset);border:1px solid var(--wz-border);border-radius:var(--wz-radius);padding:16px 18px}",
  ".wz-stat-value{font-family:var(--wz-font-display);font-weight:var(--wz-heading-weight);font-size:30px;line-height:1.1}",
  ".wz-muted{color:var(--wz-muted)}.wz-small{font-size:12px}",
  ".wz-bar{height:6px;background:var(--wz-inset);border:1px solid var(--wz-border);border-radius:999px;overflow:hidden}",
  ".wz-bar>span{display:block;height:100%;background:var(--wz-accent);transition:width .3s}",
  ".wz-list{list-style:none;margin:0;padding:0}.wz-list>li{display:flex;align-items:center;gap:12px;padding:11px 0;border-bottom:1px solid var(--wz-border)}",
  ".wz-status{font-size:12px;color:var(--wz-muted);min-height:18px;margin-top:10px}.wz-status.error{color:var(--wz-danger)}",
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
export interface BuildOptions {
  /** Live host values for the `--wz-*` variables. */
  tokens?: ThemeTokens;
  /** @font-face rules copied from the host so widgets can use its fonts. */
  fontFaceCss?: string;
  /** Origin allowed to serve font files (the host app's own origin). */
  fontOrigin?: string;
}

export function buildWidgetDocument(
  rawHtml: string,
  theme: WidgetTheme,
  options: BuildOptions = {},
): BuildResult {
  if (typeof rawHtml !== "string") return { ok: false, error: "Widget HTML is missing." };
  const html = normalizeWidgetHtml(rawHtml);
  if (!html) return { ok: false, error: "Widget HTML is empty." };
  if (new TextEncoder().encode(html).length > LIMITS.maxWidgetHtmlBytes) {
    return { ok: false, error: "Widget HTML is too large to run." };
  }

  const head =
    `<!DOCTYPE html><html data-theme="${theme}"><head>` +
    `<meta http-equiv="Content-Security-Policy" content="${widgetCsp(options.fontOrigin)}">` +
    `<meta name="referrer" content="no-referrer">` +
    `<meta name="viewport" content="width=device-width, initial-scale=1">` +
    `<style id="__wz_theme">${themeCss(theme, options.tokens)}</style>` +
    (options.fontFaceCss ? `<style id="__wz_fonts">${options.fontFaceCss}</style>` : "") +
    `<style id="__wz_base">${BASE_CSS}</style>` +
    `<script>${buildRuntimeScript(theme)}</script>`;

  return { ok: true, document: head + html };
}
