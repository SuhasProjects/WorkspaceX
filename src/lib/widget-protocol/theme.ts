import type { WidgetTheme } from "./protocol";

/** CSS variables every widget can use. Values mirror Minimal Light / Obsidian Dark. */
export const THEME_TOKENS: Record<WidgetTheme, Record<string, string>> = {
  light: {
    "--wz-background": "#ffffff",
    "--wz-surface": "#f6f7f9",
    "--wz-text": "#111827",
    "--wz-muted": "#6b7280",
    "--wz-border": "#e5e7eb",
    "--wz-accent": "#4f46e5",
    "--wz-accent-text": "#ffffff",
    "--wz-danger": "#dc2626",
    "--wz-success": "#16a34a",
  },
  dark: {
    "--wz-background": "#0b0d10",
    "--wz-surface": "#15181d",
    "--wz-text": "#e6e8eb",
    "--wz-muted": "#9aa3ae",
    "--wz-border": "#262b33",
    "--wz-accent": "#7c83ff",
    "--wz-accent-text": "#0b0d10",
    "--wz-danger": "#f87171",
    "--wz-success": "#4ade80",
  },
};

export function themeCss(theme: WidgetTheme): string {
  const vars = Object.entries(THEME_TOKENS[theme])
    .map(([name, value]) => `${name}:${value}`)
    .join(";");
  return `:root{color-scheme:${theme};${vars}}`;
}
