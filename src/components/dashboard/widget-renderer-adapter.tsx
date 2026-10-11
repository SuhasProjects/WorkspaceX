import type { WidgetRendererProps } from "@/types/contracts";

/**
 * Temporary frontend-only placeholder. Replace this export with the Engine's
 * WidgetRenderer export once its branch/import path is supplied. No iframe,
 * HTML execution, storage, or bridge logic is implemented here.
 * className is an agreed renderer extension supplied by the frontend request.
 */
export function WidgetRenderer({ className }: WidgetRendererProps & { className?: string }) {
  return <div className={`page-state ${className ?? ""}`} role="status"><h2>Widget renderer awaiting integration</h2><p>The saved tool is loaded. Its interactive content will appear when the widget-engine teammate&apos;s component is available.</p></div>;
}
