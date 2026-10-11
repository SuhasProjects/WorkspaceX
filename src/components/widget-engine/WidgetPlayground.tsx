"use client";

import { useState } from "react";
import type { WidgetTheme } from "../../lib/widget-protocol/protocol";
import { parseModelOutput } from "../../lib/widget-protocol/generation-contract";
import { WidgetRenderer } from "./WidgetRenderer";
import { configureWidgetEngine } from "./storage-adapters";
import { TEST_WIDGETS } from "./test-widgets";

/**
 * Developer page for exercising the engine without the full app. Mount it on a
 * dev-only route, e.g. src/app/dev/widgets/page.tsx rendering <WidgetPlayground />.
 * Pass workspaceId from the session to test against the real /api/storage.
 */
export function WidgetPlayground({ workspaceId = "playground" }: { workspaceId?: string }) {
  const [theme, setTheme] = useState<WidgetTheme>("light");
  const [mock, setMock] = useState(true);
  const [pasted, setPasted] = useState("");
  const [custom, setCustom] = useState<{ title: string; html: string; warnings: string[]; error?: string } | null>(null);
  const [customVersion, setCustomVersion] = useState(0);

  configureWidgetEngine({ sharedStorage: mock ? "mock" : "api" });

  const runPasted = () => {
    const result = parseModelOutput(pasted);
    setCustom(
      result.ok
        ? { ...result.widget, warnings: result.warnings }
        : { title: "", html: "", warnings: [], error: result.error },
    );
    setCustomVersion((n) => n + 1);
  };

  const dark = theme === "dark";
  const card = `rounded-lg border ${dark ? "border-neutral-800 bg-neutral-900" : "border-neutral-200 bg-white"}`;

  return (
    <div className={`min-h-screen p-6 ${dark ? "bg-neutral-950 text-neutral-100" : "bg-neutral-100 text-neutral-900"}`}>
      <div className="mb-4 flex flex-wrap items-center gap-4 text-sm">
        <h1 className="text-lg font-semibold">Widget engine playground</h1>
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={dark} onChange={(e) => setTheme(e.target.checked ? "dark" : "light")} />
          Dark theme
        </label>
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={mock} onChange={(e) => setMock(e.target.checked)} />
          Mock shared storage (uncheck to use /api/storage; requires login and saved widget ids)
        </label>
      </div>

      <div className={`${card} mb-6 p-4`}>
        <p className="mb-2 text-sm font-medium">Paste raw model output or any widget HTML</p>
        <textarea
          value={pasted}
          onChange={(e) => setPasted(e.target.value)}
          rows={6}
          className="w-full rounded border border-neutral-400 bg-transparent p-2 font-mono text-xs"
          placeholder="<!DOCTYPE html>..."
        />
        <button type="button" onClick={runPasted} className="mt-2 rounded bg-indigo-600 px-3 py-1 text-sm text-white">
          Run widget
        </button>
        {custom?.error && <p className="mt-2 text-sm text-red-500">{custom.error}</p>}
        {custom && !custom.error && (
          <div className="mt-3">
            <p className="text-sm">
              Title: <span className="font-medium">{custom.title}</span>
            </p>
            {custom.warnings.map((w) => (
              <p key={w} className="text-xs text-amber-600">⚠ {w}</p>
            ))}
            <div className="mt-2 h-80">
              <WidgetRenderer
                key={customVersion}
                widgetId="playground-custom"
                workspaceId={workspaceId}
                html={custom.html}
                theme={theme}
                preview={!mock}
                title={custom.title}
              />
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {TEST_WIDGETS.map((w) => (
          <div key={w.id} className={`${card} flex flex-col`}>
            <p className="px-3 py-2 text-sm font-medium">{w.title}</p>
            <div className="h-72">
              <WidgetRenderer widgetId={w.id} workspaceId={workspaceId} html={w.html} theme={theme} title={w.title} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
