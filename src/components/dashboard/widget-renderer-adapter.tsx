/**
 * Dashboard entry point for the widget engine. Keep importing from here so the
 * dashboard has a single place to adapt if the engine's export changes.
 * Props: widgetId, workspaceId, html, theme, plus optional preview and className.
 */
export { WidgetRenderer } from "@/components/widget-engine";
