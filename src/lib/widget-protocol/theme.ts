import type { WidgetTheme } from "./protocol";

/**
 * CSS variables every widget can use. Values match the dashboard palette in
 * src/app/globals.css so widgets blend into the page in both themes.
 */
export const THEME_TOKENS: Record<WidgetTheme, Record<string, string>> = {
  light: {
    "--wz-background": "#f7f8fa",
    "--wz-surface": "#ffffff",
    "--wz-text": "#242433",
    "--wz-muted": "#686978",
    "--wz-border": "#e6e7ee",
    "--wz-accent": "#6853cb",
    "--wz-accent-text": "#ffffff",
    "--wz-danger": "#dc2626",
    "--wz-success": "#16a34a",
  },
  dark: {
    "--wz-background": "#171820",
    "--wz-surface": "#20212c",
    "--wz-text": "#eeedf4",
    "--wz-muted": "#b0adbf",
    "--wz-border": "#373544",
    "--wz-accent": "#6853cb",
    "--wz-accent-text": "#ffffff",
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
