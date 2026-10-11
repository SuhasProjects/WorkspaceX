import type { WidgetTheme } from "./protocol";

/** CSS variables every widget can use. The host dashboard's live values override these defaults. */
export const TOKEN_NAMES = [
  "--wz-background",
  "--wz-surface",
  "--wz-text",
  "--wz-muted",
  "--wz-border",
  "--wz-accent",
  "--wz-accent-text",
  "--wz-danger",
  "--wz-success",
  "--wz-font",
  "--wz-font-display",
  "--wz-heading-weight",
  "--wz-heading-spacing",
  "--wz-radius",
  "--wz-inset",
  "--wz-hover",
  "--wz-glass",
] as const;

export type ThemeTokens = Record<string, string>;

const SHARED_DEFAULTS: ThemeTokens = {
  "--wz-font": "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  "--wz-font-display": "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  "--wz-heading-weight": "400",
  "--wz-heading-spacing": "0",
  "--wz-radius": "3px",
};

/** Fallback palette, mirroring src/app/globals.css at the time of writing. */
export const THEME_TOKENS: Record<WidgetTheme, ThemeTokens> = {
  light: {
    ...SHARED_DEFAULTS,
    "--wz-background": "#eceff3",
    "--wz-surface": "#ffffff",
    "--wz-text": "#202b3d",
    "--wz-muted": "#566376",
    "--wz-border": "rgba(61, 79, 107, .16)",
    "--wz-accent": "#39577f",
    "--wz-accent-text": "#ffffff",
    "--wz-danger": "#a53644",
    "--wz-success": "#39785a",
    "--wz-inset": "rgba(219, 227, 238, .46)",
    "--wz-hover": "rgba(65, 91, 137, .07)",
    "--wz-glass": "rgba(255, 255, 255, .7)",
  },
  dark: {
    ...SHARED_DEFAULTS,
    "--wz-background": "#101216",
    "--wz-surface": "#20242c",
    "--wz-text": "#edf0f5",
    "--wz-muted": "#adb4c2",
    "--wz-border": "rgba(224, 232, 255, .13)",
    "--wz-accent": "#b6c8f0",
    "--wz-accent-text": "#101216",
    "--wz-danger": "#ef9a9a",
    "--wz-success": "#7bc7a5",
    "--wz-inset": "rgba(9, 12, 18, .35)",
    "--wz-hover": "rgba(210, 225, 255, .08)",
    "--wz-glass": "rgba(33, 38, 48, .62)",
  },
};

const TOKEN_NAME_PATTERN = /^--wz-[a-z-]{1,40}$/;

/** Keeps only well-formed custom properties; values cannot break out of a declaration block. */
export function sanitizeTokens(input: unknown): ThemeTokens {
  const out: ThemeTokens = {};
  if (typeof input !== "object" || input === null) return out;
  for (const [name, value] of Object.entries(input as Record<string, unknown>)) {
    if (!TOKEN_NAME_PATTERN.test(name) || typeof value !== "string") continue;
    const trimmed = value.trim();
    if (!trimmed || trimmed.length > 300 || /[{};<>]/.test(trimmed)) continue;
    out[name] = trimmed;
  }
  return out;
}

export function themeCss(theme: WidgetTheme, overrides: ThemeTokens = {}): string {
  const merged = { ...THEME_TOKENS[theme], ...sanitizeTokens(overrides) };
  const vars = Object.entries(merged)
    .map(([name, value]) => `${name}:${value}`)
    .join(";");
  return `:root{color-scheme:${theme};${vars}}`;
}
