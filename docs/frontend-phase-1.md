# Frontend Phase 1 and widget pages

Dashboard foundation: header, responsive layout, calendar with month navigation,
sample to-do checklist, Kanban board, and AI panel with prompt examples and mock
loading flow. Checking a sample task updates the same task on the Kanban board.
Widgets have separate pages; the dashboard shows navigation links only.
`dashboard/mock-data.ts` isolates temporary fixtures. Mock widgets are stored in
sessionStorage for this tab; creating one opens its `?preview=1` page. These mock
pages never request authenticated data or execute HTML. Saved pages use real APIs.
Login, full task editing/persistence, real generation, and deletion await
their phases. No backend, engine, root dependencies, or shared contracts changed.

## Widget pages

`/widgets/[widgetId]` has a 64px top nav listing titles from `GET /api/widgets`,
an active link, and a link back to `/`. The dashboard and dedicated page use
`useWorkspaceWidgets` to load the same saved widget records and current workspace.
Both requests are same-origin and uncached. Loading, invalid session, empty list,
missing widget, and retry states are supported. No single-widget endpoint is
assumed; request one from Backend only if list performance proves insufficient.

The full-page renderer receives `widgetId`, `workspaceId`, `html`, `theme`, and
`className="h-[calc(100vh-64px)]"`. Its key changes when switching tools to unmount
the old renderer. Theme reads `workspacezero.theme` from browser storage. The
header toggle writes that key and dispatches `workspacezero:theme` on same-window
changes. Obsidian Dark is the default; Minimal Light is the other supported theme.

**Engine integration is pending:** the shared foundation has no renderer yet.
`dashboard/widget-renderer-adapter.tsx` is a frontend-only status placeholder,
with no iframe/runtime/HTML execution. Replace its export with the teammate's
actual `WidgetRenderer` export when the import path/branch is supplied. This
adapter is used on the dedicated widget page. Engine must accept the requested className.
No engine code was added or changed.

Frontend light color variables are `--wz-*` in `globals.css`, for Engine review.
Generation remains a later phase: the API returns unsaved `{ title, html }` and
widget saving is a separate action, as defined in `docs/api-contracts.md`.

## Run

Use Node 24, run `npm ci`, then `npm run dev`. Open http://localhost:3000.
If using this checkout's portable runtime in PowerShell:

```powershell
$env:PATH = "$PWD\.tools\node-v24.21.0-win-x64;$env:PATH"
npm.cmd run dev
```

Review a prompt example and Create preview to open its separate page, then resize the browser. Saved tool
links appear when the workspace APIs are connected and a session is valid.

Validation: `npm run typecheck` and `npm run build` passed. The build includes `/`
and `/widgets/[widgetId]`. Browser interaction and live endpoint/renderer checks
remain for integration; no additional test suite was added.

## Glass redesign

Floating frosted navigation, lightweight decorative SVG wave contours, a wide AI
command panel, glass calendar/task surfaces, and spacious tool navigation links.
No dependencies, backend routes, API contracts, or engine code were changed.
Existing browser-state initialization was updated to React subscriptions so
preview state and themes remain synchronized without effect-driven extra renders.
Responsive layouts, visible focus, reduced motion, and solid-surface blur fallbacks
are included. Redesign checks: `npm run lint -- src` and `npm run typecheck` passed.
The redesign has not been visually inspected in a browser in this environment.
